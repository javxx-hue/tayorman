// Login + password for existing admins and moderators. Only the OWNER (OWNER_TELEGRAM_IDS) can use this.
//  { action: 'me' }                    -> { owner }   (so the site knows whether to show the page)
//  { action: 'list' }                  -> every admin and moderator, with their login if they have one
//  { action: 'issue', userId, login?, password? } -> { login, password }  the owner may type the login and the
//                                         password (checked for strength); without a password one is made at
//                                         random. Issuing again replaces the old password.
//  { action: 'revoke', userId }        -> removes the login, they can still use Telegram
// The password is never stored, only its hash. Errors for a typed password: password_short, password_long,
// password_contains_login, password_common.
// Secrets: OWNER_TELEGRAM_IDS, ALLOWED_ORIGINS
import { corsHeaders, json } from '../_shared/cors.ts';
import { admin, requireUser } from '../_shared/admin.ts';
import { generatePassword, hashPassword, normalizeLogin, passwordProblem, suggestLogin, validLogin } from '../_shared/adminCredentials.ts';
import { isOwner } from '../_shared/roles.ts';
import { isStaffRole } from '../_shared/staff.ts';

type Owner = { id: string; name: string };

async function ownerOf(req: Request): Promise<Owner | null> {
  const user = await requireUser(req);
  if (!user) return null;
  const { data: p } = await admin.from('profiles').select('id, telegram_id, first_name, role, blocked').eq('id', user.id).maybeSingle();
  if (!p || p.blocked || p.role !== 'admin' || !isOwner(p.telegram_id, Deno.env.get('OWNER_TELEGRAM_IDS'))) return null;
  return { id: p.id, name: p.first_name ?? 'owner' };
}

const audit = (owner: Owner, action: string, target: string, details: Record<string, unknown>) =>
  admin.from('audit_log').insert({ actor: owner.id, actor_name: owner.name, action, target_table: 'admin_credentials', target_id: target, details });

async function list() {
  const [{ data: staff }, { data: creds }] = await Promise.all([
    admin.from('profiles').select('id, first_name, username, role, telegram_id').in('role', ['admin', 'moderator']).order('role').order('first_name'),
    admin.from('admin_credentials').select('user_id, login, created_at, password_changed_at, last_login_at, locked_until'),
  ]);
  const byUser = new Map((creds ?? []).map((c) => [c.user_id, c]));
  return (staff ?? []).map((s) => ({ ...s, credential: byUser.get(s.id) ?? null, suggested: suggestLogin(s.username, s.first_name) }));
}

async function issue(owner: Owner, userId: unknown, wantedLogin: unknown, typedPassword: unknown) {
  if (typeof userId !== 'string') return { status: 400, body: { error: 'Bad request' } };
  const { data: target } = await admin.from('profiles').select('id, role, username, first_name, blocked').eq('id', userId).maybeSingle();
  if (!target || target.blocked || !isStaffRole(target.role)) return { status: 404, body: { error: 'Only an admin or moderator can get a login' } };

  const { data: existing } = await admin.from('admin_credentials').select('login').eq('user_id', userId).maybeSingle();
  const login = normalizeLogin(wantedLogin) || existing?.login || suggestLogin(target.username, target.first_name);
  if (!validLogin(login)) return { status: 400, body: { error: 'Login: 3-32 characters, a-z, 0-9, dot, dash or underscore' } };

  const { data: taken } = await admin.from('admin_credentials').select('user_id').eq('login', login).maybeSingle();
  if (taken && taken.user_id !== userId) return { status: 409, body: { error: 'This login is already used' } };

  let password: string;
  if (typeof typedPassword === 'string' && typedPassword !== '') {
    const problem = passwordProblem(typedPassword, login);
    if (problem) return { status: 400, body: { error: `password_${problem}` } };
    password = typedPassword;
  } else {
    password = generatePassword();
  }
  const record = await hashPassword(password);
  const { error } = await admin.from('admin_credentials').upsert(
    {
      user_id: userId,
      login,
      ...record,
      failed_attempts: 0,
      locked_until: null,
      password_changed_at: new Date().toISOString(),
      created_by: owner.id,
    },
    { onConflict: 'user_id' }
  );
  if (error) {
    console.error('admin-accounts issue failed', error);
    return { status: 500, body: { error: 'Failed' } };
  }
  await audit(owner, existing ? 'login_reset' : 'login_issued', userId, { login }); // never the password
  return { status: 200, body: { login, password } };
}

async function revoke(owner: Owner, userId: unknown) {
  if (typeof userId !== 'string') return { status: 400, body: { error: 'Bad request' } };
  const { data } = await admin.from('admin_credentials').delete().eq('user_id', userId).select('login').maybeSingle();
  if (data) await audit(owner, 'login_revoked', userId, { login: data.login });
  return { status: 200, body: { ok: true } };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  const body = await req.json().catch(() => null);
  const user = await requireUser(req);
  if (!user) return json(req, { error: 'Unauthorized' }, 401);

  const owner = await ownerOf(req);
  // Anyone else just learns they are not the owner; they cannot tell the other actions exist
  if (body?.action === 'me') return json(req, { owner: owner !== null });
  if (!owner) return json(req, { error: 'Forbidden' }, 403);

  try {
    if (body?.action === 'list') return json(req, { accounts: await list() });
    if (body?.action === 'issue') {
      const r = await issue(owner, body.userId, body.login, body.password);
      return json(req, r.body, r.status);
    }
    if (body?.action === 'revoke') {
      const r = await revoke(owner, body.userId);
      return json(req, r.body, r.status);
    }
    return json(req, { error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('admin-accounts failed', e);
    return json(req, { error: 'Failed' }, 500);
  }
});
