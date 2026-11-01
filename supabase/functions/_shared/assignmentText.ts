// The bot message for a new assignment. Pure (no Deno or npm imports) so it can be unit tested.

export interface AssignmentInfo {
  title: string;
  note?: string | null;
  dueAt?: string | null; // ISO
}

// "31.10.2026 18:30" in Tashkent time, where the students are
export function formatDue(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`;
}

export function assignmentMessage(lang: 'uz' | 'ru', a: AssignmentInfo): string {
  const uz = lang === 'uz';
  const lines = [`📝 ${uz ? 'Yangi topshiriq' : 'Новое задание'}: ${a.title}`];
  if (a.note?.trim()) lines.push('', a.note.trim());
  if (a.dueAt) lines.push('', `⏰ ${uz ? 'Muddat' : 'Срок'}: ${formatDue(a.dueAt)}`);
  return lines.join('\n');
}
