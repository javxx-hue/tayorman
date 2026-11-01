// Assignment deadlines as lines in the morning reminder. Pure (no Deno or npm imports) so it can be unit tested.

export interface DueAssignment {
  id: string;
  title: string;
  dueAt: string; // ISO
  audienceAll: boolean;
  communityIds: string[];
}

// Everything the reminder needs to look at: due today or tomorrow, so nothing older or further away
export const REMINDER_WINDOW_HOURS = 48;

// "18:30" in Tashkent
const tashkentTime = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

const tashkentDay = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' }); // YYYY-MM-DD

export function dueWhen(dueIso: string, now: number): 'today' | 'tomorrow' | null {
  const due = new Date(dueIso).getTime();
  if (Number.isNaN(due) || due < now) return null; // already passed: not a reminder, a reproach
  const diff = Math.round((Date.parse(tashkentDay(due)) - Date.parse(tashkentDay(now))) / 86_400_000);
  return diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : null;
}

// Is this assignment for this student? (the whole bot audience, or one of their groups)
export const isForStudent = (a: Pick<DueAssignment, 'audienceAll' | 'communityIds'>, groups: Set<string>) =>
  a.audienceAll || a.communityIds.some((id) => groups.has(id));

// Soonest first; each line says today or tomorrow and the time (Tashkent)
export function deadlineLines(lang: 'uz' | 'ru', items: DueAssignment[], now = Date.now()): string[] {
  const uz = lang === 'uz';
  return items
    .map((a) => ({ a, when: dueWhen(a.dueAt, now) }))
    .filter((x): x is { a: DueAssignment; when: 'today' | 'tomorrow' } => x.when !== null)
    .sort((x, y) => Date.parse(x.a.dueAt) - Date.parse(y.a.dueAt))
    .map(({ a, when }) => {
      const time = tashkentTime(a.dueAt);
      const word = when === 'today' ? (uz ? 'bugun' : 'сегодня') : uz ? 'ertaga' : 'завтра';
      return uz ? `• ${a.title}: ${word} ${time} gacha` : `• ${a.title}: ${word} до ${time}`;
    });
}
