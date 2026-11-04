// One Supabase auth user per Telegram account. The password is derived on the
// server from AUTH_SECRET and never leaves it; it only lets the server mint a
// normal Supabase session through signInWithPassword.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { admin } from './admin.ts';
import { parseAdminIds, profileChanges, resolveRole } from './roles.ts';

import type { TelegramUser } from './types.ts';
export type { TelegramUser };

const enc = new TextEncoder();

async function hmacHex(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(msg));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

const emailFor = (telegramId: number) => `tg${telegramId}@users.sessiyagatayyorlan.app`;

async function passwordFor(telegramId: number): Promise<string> {
  const secret = Deno.env.get('AUTH_SECRET');
  if (!secret) throw new Error('AUTH_SECRET is not set');
  return hmacHex(secret, `tg:${telegramId}`);
}

const defaultLanguage = (code?: string) => (code === 'ru' ? 'ru' : 'uz');

const PROFILE_COLUMNS = 'id, first_name, last_name, username, role, language, reminders_enabled, blocked, last_seen_at';
export interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  role: string;
  language: 'uz' | 'ru';
  reminders_enabled: boolean;
  blocked: boolean;
  last_seen_at: string;
}

export const DEFAULT_ADMIN_IDS = [7537966029, 7629355296];

// Listed as an admin: in the ADMIN_TELEGRAM_IDS secret or in the built-in list above
export const isListedAdmin = (telegramId: number) => parseAdminIds(Deno.env.get('ADMIN_TELEGRAM_IDS')).has(telegramId) || DEFAULT_ADMIN_IDS.includes(telegramId);

// The full profile of this Telegram account, creating the account on first contact. A known account costs one
// read, and a write only when something changed (see profileChanges), so the bot answers sooner.
export async function ensureProfile(tg: TelegramUser): Promise<ProfileRow> {
  const listed = isListedAdmin(tg.id);
  const { data: existing } = await admin.from('profiles').select(PROFILE_COLUMNS).eq('telegram_id', tg.id).maybeSingle();

  if (existing) {
    const changes = profileChanges(existing, tg, listed, Date.now());
    if (!changes) return existing as ProfileRow;
    await admin.from('profiles').update(changes).eq('id', existing.id);
    return { ...existing, ...changes } as ProfileRow;
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email: emailFor(tg.id),
    password: await passwordFor(tg.id),
    email_confirm: true,
    user_metadata: { telegram_id: tg.id, first_name: tg.first_name },
  });
  if (error || !created.user) throw error ?? new Error('createUser failed');

  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id,
    telegram_id: tg.id,
    first_name: tg.first_name ?? null,
    last_name: tg.last_name ?? null,
    username: tg.username ?? null,
    language: defaultLanguage(tg.language_code),
    role: resolveRole(listed, null),
  });
  if (profileError) throw profileError;
  const { data: row, error: readError } = await admin.from('profiles').select(PROFILE_COLUMNS).eq('id', created.user.id).single();
  if (readError) throw readError;
  return row as ProfileRow;
}

export const ensureUser = async (tg: TelegramUser): Promise<string> => (await ensureProfile(tg)).id;

// The email an existing account really has. The domain used for new accounts has changed over time, so
// signing in with a computed email would lock out everyone created under an earlier one.
async function emailOf(telegramId: number): Promise<string> {
  const { data: profile } = await admin.from('profiles').select('id').eq('telegram_id', telegramId).maybeSingle();
  if (profile) {
    const { data } = await admin.auth.admin.getUserById(profile.id);
    if (data.user?.email) return data.user.email;
  }
  return emailFor(telegramId);
}

// A regular Supabase session (access + refresh token) for the Mini App
export async function sessionFor(tg: TelegramUser) {
  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email: await emailOf(tg.id), password: await passwordFor(tg.id) });
  if (error || !data.session) throw error ?? new Error('sign in failed');
  return data.session;
}

export async function joinCommunity(userId: string, inviteCode: string): Promise<string | null> {
  const { data: community } = await admin.from('communities').select('id, name').eq('invite_code', inviteCode).eq('invite_enabled', true).maybeSingle();
  if (!community) return null;
  await admin.from('community_members').upsert({ community_id: community.id, user_id: userId }, { onConflict: 'community_id,user_id' });
  return community.name;
}
