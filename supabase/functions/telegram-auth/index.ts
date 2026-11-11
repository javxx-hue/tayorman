// Mini App sign-in: verifies Telegram initData and returns a Supabase session.
// Also handles a start param "c_<code>" (joining a community from a link).
// Secrets: TELEGRAM_BOT_TOKEN, AUTH_SECRET, ADMIN_TELEGRAM_IDS, ALLOWED_ORIGINS
import { corsHeaders, json } from '../_shared/cors.ts';
import { verifyInitData } from '../_shared/initData.ts';
import { ensureUser, joinCommunity, sessionFor } from '../_shared/users.ts';
import { admin } from '../_shared/admin.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  const body = await req.json().catch(() => null);
  const initData = typeof body?.initData === 'string' ? body.initData : '';
  const verified = initData ? await verifyInitData(initData, Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '') : null;
  if (!verified) return json(req, { error: 'Invalid Telegram data' }, 401);

  try {
    const userId = await ensureUser(verified.user);
    let joined: string | null = null;
    const code = verified.startParam?.match(/^c_([a-f0-9]{12})$/)?.[1];
    if (code) {
      const result = await joinCommunity(userId, code);
      joined = result.status === 'joined' ? result.name : null;
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('id, telegram_id, first_name, username, language, university, role, reminders_enabled, board_ai, blocked')
      .eq('id', userId)
      .single();
    if (profile?.blocked) return json(req, { error: 'Account is blocked' }, 403);
    const session = await sessionFor(verified.user);
    const { blocked: _blocked, ...publicProfile } = profile ?? {};
    return json(req, { session, profile: publicProfile, joined });
  } catch (e) {
    console.error('telegram-auth failed', e);
    return json(req, { error: 'Sign in failed' }, 500);
  }
});
