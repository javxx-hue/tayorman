// An admin writes to any one user from the admin site; the message goes out through the bot.
// Body: { userId, text }. Admin role only. Every message is written to the audit log (who, to whom, the text).
// Secrets: TELEGRAM_BOT_TOKEN, ALLOWED_ORIGINS
import { corsHeaders, json } from '../_shared/cors.ts';
import { admin, isAdmin, requireUser } from '../_shared/admin.ts';
import { sendMessage } from '../_shared/telegram.ts';
import { directMessageBody, directMessageText } from '../_shared/directMessage.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  const user = await requireUser(req);
  if (!user || !(await isAdmin(user.id))) return json(req, { error: 'Forbidden' }, 403);

  const payload = await req.json().catch(() => null);
  const userId = typeof payload?.userId === 'string' ? payload.userId : '';
  const body = directMessageBody(payload?.text);
  if (!userId || !body) return json(req, { error: 'Bad request' }, 400);

  const { data: who } = await admin.from('profiles').select('telegram_id, language, blocked').eq('id', userId).maybeSingle();
  if (!who?.telegram_id) return json(req, { error: 'Not found' }, 404);
  if (who.blocked) return json(req, { error: 'Blocked' }, 409);

  const delivered = await sendMessage(who.telegram_id, directMessageText(who.language === 'ru' ? 'ru' : 'uz', body));

  const { data: me } = await admin.from('profiles').select('first_name, username').eq('id', user.id).maybeSingle();
  await admin.from('audit_log').insert({
    actor: user.id,
    actor_name: me?.first_name || me?.username || 'admin',
    action: 'message',
    target_table: 'profiles',
    target_id: userId,
    details: { telegram_id: who.telegram_id, delivered, text: body },
  });
  return json(req, { ok: true, delivered });
});
