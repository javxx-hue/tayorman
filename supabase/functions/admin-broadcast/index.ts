// Admin sends a message through the bot to everyone or to chosen communities.
// Body: { text, audienceAll: boolean, communityIds: string[] }
// Telegram allows ~30 messages/second; we send ~20/s. One call handles up to
// MAX_RECIPIENTS users (enough for the beta); larger audiences need batching.
// Secrets: TELEGRAM_BOT_TOKEN, APP_URL, ALLOWED_ORIGINS
import { corsHeaders, json } from '../_shared/cors.ts';
import { admin, isAdmin, requireUser } from '../_shared/admin.ts';
import { sendMessage, openAppButton } from '../_shared/telegram.ts';

const MAX_RECIPIENTS = 2500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  const user = await requireUser(req);
  if (!user || !(await isAdmin(user.id))) return json(req, { error: 'Admin only' }, 403);

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const audienceAll = body?.audienceAll !== false;
  const communityIds: string[] = Array.isArray(body?.communityIds) ? body.communityIds.filter((x: unknown) => typeof x === 'string') : [];
  if (!text || text.length > 4000) return json(req, { error: 'Text is required (max 4000)' }, 400);
  if (!audienceAll && !communityIds.length) return json(req, { error: 'Choose an audience' }, 400);

  let recipients: { telegram_id: number; language: string }[] = [];
  if (audienceAll) {
    const { data } = await admin.from('profiles').select('telegram_id, language').limit(MAX_RECIPIENTS);
    recipients = data ?? [];
  } else {
    const { data: members } = await admin.from('community_members').select('user_id').in('community_id', communityIds);
    const ids = [...new Set((members ?? []).map((m: { user_id: string }) => m.user_id))].slice(0, MAX_RECIPIENTS);
    if (ids.length) {
      const { data } = await admin.from('profiles').select('telegram_id, language').in('id', ids);
      recipients = data ?? [];
    }
  }

  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const ok = await sendMessage(r.telegram_id, text, {
      reply_markup: { inline_keyboard: [[openAppButton(r.language === 'ru' ? '📚 Открыть' : '📚 Ochish')]] },
    });
    ok ? sent++ : failed++; // failures are mostly users who blocked the bot
    await sleep(50);
  }

  await admin.from('broadcasts').insert({ text, audience_all: audienceAll, community_ids: communityIds, sent_count: sent, failed_count: failed, created_by: user.id });
  return json(req, { sent, failed, truncated: recipients.length >= MAX_RECIPIENTS });
});
