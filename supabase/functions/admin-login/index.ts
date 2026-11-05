// Admin site sign-in. Three ways in, all end in a session for an admin or moderator only:
//  { initData }  the site was opened from the bot's "Admin" menu button, so it holds Telegram's own signed
//                Mini App data, checked here with the bot token
//  { nonce }     the site was opened in a normal browser: the admin confirmed the nonce in the bot, and it is
//                handed over once, within 5 minutes
//  { login, password }  issued by the owner (function "admin-accounts"); 5 wrong passwords pause the login for 15 minutes
// Admin = listed in ADMIN_TELEGRAM_IDS. Deploy with --no-verify-jwt (the proof above is the credential).
// Secrets: TELEGRAM_BOT_TOKEN, ADMIN_TELEGRAM_IDS, AUTH_SECRET, ALLOWED_ORIGINS (incl. the admin site)
import { corsHeaders, json } from '../_shared/cors.ts';
import { admin } from '../_shared/admin.ts';
import { verifyInitData } from '../_shared/initData.ts';
import { ensureUser, isListedAdmin, sessionFor } from '../_shared/users.ts';
import { isFresh, NONCE_RE, nonceHash } from '../_shared/loginNonce.ts';
import { isStaffRole } from '../_shared/staff.ts';
import { normalizeLogin, spendTheSameTime, validLogin, verifyPassword } from '../_shared/adminCredentials.ts';

// Who the request proves to be: a user id, or the answer to send instead
type Identity = { userId: string } | { reply: Response };

async function fromInitData(req: Request, initData: string, denied: () => Response): Promise<Identity> {
  const verified = await verifyInitData(initData, Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '');
  if (!verified) return { reply: json(req, { error: 'Invalid Telegram data' }, 401) };

  // No accounts for strangers: only listed admins or people who already use the bot may continue
  const { data: known } = await admin.from('profiles').select('id').eq('telegram_id', verified.user.id).maybeSingle();
  if (!isListedAdmin(verified.user.id) && !known) return { reply: denied() };
  return { userId: await ensureUser(verified.user) }; // also syncs the role with ADMIN_TELEGRAM_IDS
}

async function fromNonce(req: Request, nonce: string): Promise<Identity> {
  if (!NONCE_RE.test(nonce)) return { reply: json(req, { error: 'Bad request' }, 400) };
  const hash = await nonceHash(nonce);
  const { data: row } = await admin.from('admin_login_requests').select('user_id, approved_at, used_at').eq('nonce_hash', hash).maybeSingle();
  if (!row) return { reply: json(req, { pending: true }) }; // not confirmed yet
  if (row.used_at || !isFresh(row.approved_at)) return { reply: json(req, { error: 'Expired' }, 410) };

  // Claim it: of two parallel requests only one gets the row back
  const { data: claimed } = await admin
    .from('admin_login_requests')
    .update({ used_at: new Date().toISOString() })
    .eq('nonce_hash', hash)
    .is('used_at', null)
    .select('user_id')
    .maybeSingle();
  if (!claimed) return { reply: json(req, { error: 'Expired' }, 410) };
  return { userId: claimed.user_id };
}

// The same refusal for an unknown login, a wrong password and a paused login: nothing tells them apart
async function fromPassword(req: Request, rawLogin: unknown, password: string, denied: () => Response): Promise<Identity> {
  const login = normalizeLogin(rawLogin);
  if (!validLogin(login) || password.length < 1 || password.length > 200) {
    await spendTheSameTime(password);
    return { reply: denied() };
  }
  const { data: row } = await admin
    .from('admin_credentials')
    .select('user_id, salt, hash, iterations, locked_until')
    .eq('login', login)
    .maybeSingle();
  if (!row) {
    await spendTheSameTime(password);
    return { reply: denied() };
  }
  if (row.locked_until && Date.parse(row.locked_until) > Date.now()) return { reply: denied() };

  if (!(await verifyPassword(password, row))) {
    await admin.rpc('admin_login_failed', { p_login: login });
    return { reply: denied() };
  }
  await admin.from('admin_credentials').update({ failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() }).eq('login', login);
  return { userId: row.user_id };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  const body = await req.json().catch(() => null);
  // The same answer for "not allowed" whatever the reason, so the list of admins cannot be probed
  const denied = () => json(req, { error: 'Access denied' }, 403);

  try {
    const who =
      typeof body?.initData === 'string' && body.initData
        ? await fromInitData(req, body.initData, denied)
        : typeof body?.login === 'string' && typeof body?.password === 'string'
          ? await fromPassword(req, body.login, body.password, denied)
          : typeof body?.nonce === 'string'
            ? await fromNonce(req, body.nonce)
            : { reply: json(req, { error: 'Bad request' }, 400) };
    if ('reply' in who) return who.reply;

    // The role is checked here, whichever way the person was identified
    const { data: profile } = await admin.from('profiles').select('id, telegram_id, first_name, role, blocked').eq('id', who.userId).single();
    if (!profile || profile.blocked || !isStaffRole(profile.role)) return denied();

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
