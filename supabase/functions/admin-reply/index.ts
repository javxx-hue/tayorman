// An admin answers a student's request from the admin site. The answer is saved and sent
// to the student in the bot. Admin role only.
// Secrets: TELEGRAM_BOT_TOKEN
import { corsHeaders, json } from '../_shared/cors.ts';
import { admin, isAdmin, requireUser } from '../_shared/admin.ts';
import { sendMessage } from '../_shared/telegram.ts';

const STATUSES = ['new', 'seen', 'accepted', 'declined'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  const user = await requireUser(req);
  if (!user || !(await isAdmin(user.id))) return json(req, { error: 'Forbidden' }, 403);

  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  const status = String(body?.status ?? '');
  const reply = typeof body?.reply === 'string' ? body.reply.trim().slice(0, 2000) : '';
  if (!Number.isInteger(id) || !STATUSES.includes(status)) return json(req, { error: 'Bad request' }, 400);

  const { data: row } = await admin.from('suggestions').select('id, user_id, text').eq('id', id).maybeSingle();
  if (!row) return json(req, { error: 'Not found' }, 404);

  const patch: Record<string, unknown> = { status };
  if (reply) Object.assign(patch, { admin_reply: reply, replied_at: new Date().toISOString() });
  const { error } = await admin.from('suggestions').update(patch).eq('id', id);
  if (error) return json(req, { error: 'Failed' }, 500);

  let delivered = false;
  if (reply) {
    const { data: who } = await admin.from('profiles').select('telegram_id, language').eq('id', row.user_id).maybeSingle();
    if (who?.telegram_id) {
      const uz = who.language !== 'ru';
      const head = uz ? '💬 Adminning javobi' : '💬 Ответ администратора';
      const yours = uz ? 'Sizning so\'rovingiz' : 'Ваш запрос';
      delivered = await sendMessage(who.telegram_id, `${head}\n\n${reply}\n\n— ${yours}: «${String(row.text).slice(0, 120)}»`);
    }
  }
  return json(req, { ok: true, delivered });
});
