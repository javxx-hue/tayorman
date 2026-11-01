// Admin site sign-in. The site sends the nonce it gave the bot; once an admin or moderator
// has confirmed it in the bot, this returns a Supabase session (once, within 5 minutes).
// Admin = listed in ADMIN_TELEGRAM_IDS. Deploy with --no-verify-jwt (the confirmation is the credential).
// Secrets: ADMIN_TELEGRAM_IDS, AUTH_SECRET, ALLOWED_ORIGINS (incl. the admin site)
import { corsHeaders, json } from '../_shared/cors.ts';
import { admin } from '../_shared/admin.ts';
import { sessionFor } from '../_shared/users.ts';
import { isFresh, NONCE_RE, nonceHash } from '../_shared/loginNonce.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  const body = await req.json().catch(() => null);
  const nonce = typeof body?.nonce === 'string' ? body.nonce : '';
  if (!NONCE_RE.test(nonce)) return json(req, { error: 'Bad request' }, 400);

  try {
    const hash = await nonceHash(nonce);
    const { data: row } = await admin.from('admin_login_requests').select('user_id, approved_at, used_at').eq('nonce_hash', hash).maybeSingle();
    if (!row) return json(req, { pending: true }); // not confirmed yet
    if (row.used_at || !isFresh(row.approved_at)) return json(req, { error: 'Expired' }, 410);

    // Claim it: of two parallel requests only one gets the row back
    const { data: claimed } = await admin
      .from('admin_login_requests')
      .update({ used_at: new Date().toISOString() })
      .eq('nonce_hash', hash)
      .is('used_at', null)
      .select('user_id')
      .maybeSingle();
    if (!claimed) return json(req, { error: 'Expired' }, 410);

    // Role is checked again here, not only when the bot confirmed
    const { data: profile } = await admin.from('profiles').select('id, telegram_id, first_name, role, blocked').eq('id', claimed.user_id).single();
    if (!profile || profile.blocked || !['admin', 'moderator'].includes(profile.role)) return json(req, { error: 'Access denied' }, 403);

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
