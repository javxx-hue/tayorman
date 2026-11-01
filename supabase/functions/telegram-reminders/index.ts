// Daily reminder at 08:00 Tashkent: each student with reminders on gets today's plan
// and the assignments that are due today or tomorrow and not done yet.
// Run by pg_cron (see README) with the x-cron-secret header.
// Secrets: TELEGRAM_BOT_TOKEN, CRON_SECRET, APP_URL
import { admin } from '../_shared/admin.ts';
import { sendMessage, openAppButton } from '../_shared/telegram.ts';
import { planLines } from '../_shared/plan.ts';
import { deadlineLines, isForStudent, REMINDER_WINDOW_HOURS, type DueAssignment } from '../_shared/deadlines.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Active assignments due soon, who is in which group, and who has already finished what
async function loadDeadlines(now: number) {
  const { data } = await admin
    .from('assignments')
    .select('id, title, due_at, audience_all, community_ids')
    .eq('status', 'active')
    .gt('due_at', new Date(now).toISOString())
    .lt('due_at', new Date(now + REMINDER_WINDOW_HOURS * 3_600_000).toISOString());
  const assignments: DueAssignment[] = (data ?? []).map((a) => ({ id: a.id, title: a.title, dueAt: a.due_at, audienceAll: a.audience_all, communityIds: a.community_ids ?? [] }));

  const groups = new Map<string, Set<string>>(); // user -> their groups
  const groupIds = [...new Set(assignments.flatMap((a) => a.communityIds))];
  if (groupIds.length) {
    const { data: members } = await admin.from('community_members').select('user_id, community_id').in('community_id', groupIds);
    for (const m of members ?? []) groups.set(m.user_id, (groups.get(m.user_id) ?? new Set()).add(m.community_id));
  }

  const done = new Set<string>(); // "assignment:user"
  if (assignments.length) {
    const { data: finished } = await admin.from('assignment_progress').select('assignment_id, user_id').eq('status', 'done').in('assignment_id', assignments.map((a) => a.id));
    for (const p of finished ?? []) done.add(`${p.assignment_id}:${p.user_id}`);
  }
  return { assignments, groups, done };
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response('forbidden', { status: 403 });
  }

  const { data: users, error } = await admin.from('profiles').select('id, telegram_id, language').eq('reminders_enabled', true).eq('blocked', false);
  if (error) return new Response(error.message, { status: 500 });

  const now = Date.now();
  const { assignments, groups, done } = await loadDeadlines(now);

  let sent = 0;
  for (const u of users ?? []) {
    const lang = u.language === 'ru' ? 'ru' : 'uz';
    const mine = assignments.filter((a) => isForStudent(a, groups.get(u.id) ?? new Set()) && !done.has(`${a.id}:${u.id}`));
    const due = deadlineLines(lang, mine, now);
    const plan = await planLines(u.id, lang);
    if (!plan.length && !due.length) continue; // nothing planned: stay quiet

    const parts: string[] = [];
    if (plan.length) parts.push(`${lang === 'uz' ? '📚 Bugungi reja' : '📚 План на сегодня'}\n\n${plan.join('\n')}`);
    if (due.length) parts.push(`${lang === 'uz' ? '⏰ Topshiriq muddatlari' : '⏰ Сроки заданий'}\n\n${due.join('\n')}`);
    const ok = await sendMessage(u.telegram_id, parts.join('\n\n'), {
      reply_markup: { inline_keyboard: [[openAppButton(lang === 'uz' ? '📚 Ochish' : '📚 Открыть', due.length ? '/assignments' : '')]] },
    });
    if (ok) sent++;
    await sleep(50);
  }

  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } });
});
