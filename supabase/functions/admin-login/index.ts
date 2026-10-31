// Admin site sign-in with the "Login with Telegram" widget. The widget data is verified with
// the bot token (see _shared/widgetAuth.ts), then the person must be an admin or moderator.
// Admin = listed in ADMIN_TELEGRAM_IDS. Deploy with --no-verify-jwt (the signed data is the credential).
// Secrets: TELEGRAM_BOT_TOKEN, ADMIN_TELEGRAM_IDS, AUTH_SECRET, ALLOWED_ORIGINS (incl. the admin site)
import { corsHeaders, json } from '../_shared/cors.ts';
import { admin } from '../_shared/admin.ts';
import { ensureUser, sessionFor } from '../_shared/users.ts';
import { verifyLoginWidget } from '../_shared/widgetAuth.ts';
import { parseAdminIds } from '../_shared/roles.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  const body = await req.json().catch(() => null);
  const tg = await verifyLoginWidget(body?.widget ?? {}, Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '');
  if (!tg) return json(req, { error: 'Invalid Telegram data' }, 401);

  // The same answer for "not allowed" whatever the reason, so the list of admins cannot be probed
  const denied = () => json(req, { error: 'Access denied' }, 403);

  try {
    // No accounts for strangers: only listed admins or people who already use the bot may continue
    const listed = parseAdminIds(Deno.env.get('ADMIN_TELEGRAM_IDS')).has(tg.id);
    const { data: known } = await admin.from('profiles').select('id').eq('telegram_id', tg.id).maybeSingle();
    if (!listed && !known) return denied();

    const userId = await ensureUser(tg); // also syncs the role with ADMIN_TELEGRAM_IDS
    const { data: profile } = await admin.from('profiles').select('id, telegram_id, first_name, role, blocked').eq('id', userId).single();
    if (!profile || profile.blocked || !['admin', 'moderator'].includes(profile.role)) return denied();

    const session = await sessionFor({ id: profile.telegram_id });
    await admin.from('audit_log').insert({
      actor: profile.id,
      actor_name: profile.first_name ?? 'admin',
      action: 'login',
      target_table: 'admin_site',
      details: { role: profile.role },
    });
    return json(req, { session, profile: { id: profile.id, first_name: profile.first_name, role: profile.role } });
  } catch (e) {
    console.error('admin-login failed', e);
    return json(req, { error: 'Sign in failed' }, 500);
  }
});
