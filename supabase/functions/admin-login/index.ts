// Admin site sign-in: exchanges the one-time code from the bot (/admin) for a Supabase session.
// Only admins and moderators get one. Deploy with --no-verify-jwt (the code is the credential).
// Secrets: AUTH_SECRET, ALLOWED_ORIGINS (must include the admin site origin)
import { corsHeaders, json } from '../_shared/cors.ts';
import { admin } from '../_shared/admin.ts';
import { redeemLoginCode } from '../_shared/adminLogin.ts';
import { sessionFor } from '../_shared/users.ts';
import { LOGIN_CODE_RE } from '../_shared/roles.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  const body = await req.json().catch(() => null);
  const code = typeof body?.code === 'string' ? body.code : '';
  // Same answer for every failure, so nobody can tell a wrong code from an expired one
  const denied = () => json(req, { error: 'Invalid or expired link' }, 401);
  if (!LOGIN_CODE_RE.test(code)) return denied();

  const userId = await redeemLoginCode(code);
  if (!userId) return denied();

  const { data: profile } = await admin
    .from('profiles')
    .select('id, telegram_id, first_name, role, blocked')
    .eq('id', userId)
    .maybeSingle();
  if (!profile || profile.blocked || !['admin', 'moderator'].includes(profile.role)) return denied();

  try {
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
