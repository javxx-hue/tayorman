// One Supabase auth user per Telegram account. The password is derived on the
// server from AUTH_SECRET and never leaves it; it only lets the server mint a
// normal Supabase session through signInWithPassword.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { admin } from './admin.ts';
import { parseAdminIds, resolveRole } from './roles.ts';

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

export const DEFAULT_ADMIN_IDS = [7537966029, 7629355296];

// Returns the auth user id for this Telegram account, creating it on first contact.
export async function ensureUser(tg: TelegramUser): Promise<string> {
  const listed = parseAdminIds(Deno.env.get('ADMIN_TELEGRAM_IDS')).has(tg.id) || DEFAULT_ADMIN_IDS.includes(tg.id);
  const { data: existing } = await admin.from('profiles').select('id, role').eq('telegram_id', tg.id).maybeSingle();

  if (existing) {
    await admin
      .from('profiles')
      .update({
        first_name: tg.first_name ?? null,
        last_name: tg.last_name ?? null,
        username: tg.username ?? null,
        last_seen_at: new Date().toISOString(),
        // ADMIN_TELEGRAM_IDS decides who is admin; moderators keep their role
        role: resolveRole(listed, existing.role),
      })
      .eq('id', existing.id);
    return existing.id;
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
  return created.user.id;
}

// A regular Supabase session (access + refresh token) for the Mini App
export async function sessionFor(tg: TelegramUser) {
  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email: emailFor(tg.id), password: await passwordFor(tg.id) });
  if (error || !data.session) throw error ?? new Error('sign in failed');
  return data.session;
}

export async function joinCommunity(userId: string, inviteCode: string): Promise<string | null> {
  const { data: community } = await admin.from('communities').select('id, name').eq('invite_code', inviteCode).eq('invite_enabled', true).maybeSingle();
  if (!community) return null;
  await admin.from('community_members').upsert({ community_id: community.id, user_id: userId }, { onConflict: 'community_id,user_id' });
  return community.name;
}
