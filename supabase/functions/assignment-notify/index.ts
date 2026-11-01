// Tells the students of an assignment about it in the bot, once.
// Body: { id }. Allowed: admins, and the moderator who created an assignment for their own groups.
// Telegram allows ~30 messages/second; we send ~20/s. One call handles up to MAX_RECIPIENTS users.
// Secrets: TELEGRAM_BOT_TOKEN, APP_URL, ALLOWED_ORIGINS
import { corsHeaders, json } from '../_shared/cors.ts';
import { admin, isAdmin, requireUser } from '../_shared/admin.ts';
import { openAppButton, sendMessage } from '../_shared/telegram.ts';
import { assignmentMessage } from '../_shared/assignmentText.ts';

const MAX_RECIPIENTS = 2500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A moderator may announce only assignments they made for groups they moderate
async function moderatesAll(userId: string, communityIds: string[]): Promise<boolean> {
  if (!communityIds.length) return false;
  const { data: me } = await admin.from('profiles').select('role, blocked').eq('id', userId).maybeSingle();
  if (me?.role !== 'moderator' || me.blocked) return false;
  const { data } = await admin.from('community_moderators').select('community_id').eq('user_id', userId).in('community_id', communityIds);
  return new Set((data ?? []).map((r: { community_id: string }) => r.community_id)).size === new Set(communityIds).size;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  const user = await requireUser(req);
  if (!user) return json(req, { error: 'Unauthorized' }, 401);
  const body = await req.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) return json(req, { error: 'Bad request' }, 400);

  const { data: a } = await admin.from('assignments').select('id, title, note, due_at, audience_all, community_ids, status, notify, created_by').eq('id', id).maybeSingle();
  if (!a) return json(req, { error: 'Not found' }, 404);
  const allowed = (await isAdmin(user.id)) || (!a.audience_all && a.created_by === user.id && (await moderatesAll(user.id, a.community_ids)));
  if (!allowed) return json(req, { error: 'Forbidden' }, 403);
  if (a.status !== 'active' || !a.notify) return json(req, { sent: 0, failed: 0, skipped: true });

  // Claim it: of two parallel calls only one gets the row back, so nobody is messaged twice
  const { data: claimed } = await admin.from('assignments').update({ notified_at: new Date().toISOString() }).eq('id', id).is('notified_at', null).select('id').maybeSingle();
  if (!claimed) return json(req, { sent: 0, failed: 0, skipped: true });

  let recipients: { telegram_id: number; language: string }[] = [];
  if (a.audience_all) {
    const { data } = await admin.from('profiles').select('telegram_id, language').eq('blocked', false).limit(MAX_RECIPIENTS);
    recipients = data ?? [];
  } else {
    const { data: members } = await admin.from('community_members').select('user_id').in('community_id', a.community_ids);
    const ids = [...new Set((members ?? []).map((m: { user_id: string }) => m.user_id))].slice(0, MAX_RECIPIENTS);
    if (ids.length) {
      const { data } = await admin.from('profiles').select('telegram_id, language').eq('blocked', false).in('id', ids);
      recipients = data ?? [];
    }
  }

  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const lang = r.language === 'ru' ? 'ru' : 'uz';
    const ok = await sendMessage(r.telegram_id, assignmentMessage(lang, { title: a.title, note: a.note, dueAt: a.due_at }), {
      reply_markup: { inline_keyboard: [[openAppButton(lang === 'ru' ? '📝 Открыть' : '📝 Ochish', '/assignments')]] },
    });
    ok ? sent++ : failed++; // failures are mostly users who blocked the bot
    await sleep(50);
  }
  return json(req, { sent, failed, truncated: recipients.length >= MAX_RECIPIENTS });
});
