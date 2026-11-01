// Delivers one broadcast through the bot and records how many messages arrived.
// Used by admin-broadcast (send now) and broadcast-due (scheduled, run by pg_cron every minute).
import { admin } from './admin.ts';
import { openAppButton, sendMessage } from './telegram.ts';

// Telegram allows ~30 messages/second; we send ~20/s. One run handles up to MAX_RECIPIENTS users,
// which is enough for the beta; larger audiences need batching.
const MAX_RECIPIENTS = 2500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Recipient {
  telegram_id: number;
  language: string;
}

async function recipientsOf(audienceAll: boolean, communityIds: string[]): Promise<Recipient[]> {
  if (audienceAll) {
    const { data } = await admin.from('profiles').select('telegram_id, language').eq('blocked', false).limit(MAX_RECIPIENTS);
    return data ?? [];
  }
  const { data: members } = await admin.from('community_members').select('user_id').in('community_id', communityIds);
  const ids = [...new Set((members ?? []).map((m: { user_id: string }) => m.user_id))].slice(0, MAX_RECIPIENTS);
  if (!ids.length) return [];
  const { data } = await admin.from('profiles').select('telegram_id, language').eq('blocked', false).in('id', ids);
  return data ?? [];
}

// Returns null when another run already took this broadcast (or it was cancelled meanwhile)
export async function deliverBroadcast(id: number): Promise<{ sent: number; failed: number; total: number; truncated: boolean } | null> {
  // Claim it: of two runs only one gets the row back, so nobody is messaged twice
  const { data: b } = await admin
    .from('broadcasts')
    .update({ status: 'sending' })
    .eq('id', id)
    .eq('status', 'scheduled')
    .select('text, audience_all, community_ids')
    .maybeSingle();
  if (!b) return null;

  const recipients = await recipientsOf(b.audience_all, b.community_ids ?? []);
  await admin.from('broadcasts').update({ total_count: recipients.length }).eq('id', id);

  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const ok = await sendMessage(r.telegram_id, b.text, {
      reply_markup: { inline_keyboard: [[openAppButton(r.language === 'ru' ? '📚 Открыть' : '📚 Ochish')]] },
    });
    ok ? sent++ : failed++; // failures are mostly users who blocked the bot
    await sleep(50);
  }

  await admin.from('broadcasts').update({ status: 'sent', sent_count: sent, failed_count: failed, sent_at: new Date().toISOString() }).eq('id', id);
  return { sent, failed, total: recipients.length, truncated: recipients.length >= MAX_RECIPIENTS };
}
