// Daily reminder at 08:00 Tashkent: each student with reminders on gets
// today's plan. Run by pg_cron (see README) with the x-cron-secret header.
// Secrets: TELEGRAM_BOT_TOKEN, CRON_SECRET, APP_URL
import { admin } from '../_shared/admin.ts';
import { sendMessage, openAppButton } from '../_shared/telegram.ts';
import { planLines } from '../_shared/plan.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response('forbidden', { status: 403 });
  }

  const { data: users, error } = await admin.from('profiles').select('id, telegram_id, language').eq('reminders_enabled', true).eq('blocked', false);
  if (error) return new Response(error.message, { status: 500 });

  let sent = 0;
  for (const u of users ?? []) {
    const lang = u.language === 'ru' ? 'ru' : 'uz';
    const lines = await planLines(u.id, lang);
    if (!lines.length) continue; // nothing planned: stay quiet
    const title = lang === 'uz' ? '📚 Bugungi reja' : '📚 План на сегодня';
    const ok = await sendMessage(u.telegram_id, `${title}\n\n${lines.join('\n')}`, {
      reply_markup: { inline_keyboard: [[openAppButton(lang === 'uz' ? '📚 Ochish' : '📚 Открыть')]] },
    });
    if (ok) sent++;
    await sleep(50);
  }

  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } });
});
