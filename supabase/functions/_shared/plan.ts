// Today's plan as bot text. Mirrors src/lib/prep.ts (planSubject) and
// src/lib/srs.ts (dueQueue) in reduced form; keep the rules in sync.
import { admin } from './admin.ts';

const PASS_SCORE = 71;

type Question = { attempts: { score: number }[] };
type Subject = { name: string; examDate: string; questions: Question[] };
type Card = { srs?: { due: string; state: number } };
type StudySet = { flashcards?: Card[] };

export function tashkentToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' }); // YYYY-MM-DD
}

function subjectLine(s: Subject, today: string, lang: 'uz' | 'ru'): string | null {
  const uz = lang === 'uz';
  const daysLeft = Math.round((Date.parse(s.examDate) - Date.parse(today)) / 86_400_000);
  if (daysLeft < 0) return null;
  if (daysLeft === 0) return uz ? `• ${s.name}: imtihon bugun. Omad! 🍀` : `• ${s.name}: экзамен сегодня. Удачи! 🍀`;
  const remaining = s.questions.filter((q) => (q.attempts.at(-1)?.score ?? 0) < PASS_SCORE).length;
  const when = daysLeft === 1 ? (uz ? 'imtihon ertaga' : 'экзамен завтра') : uz ? `${daysLeft} kun qoldi` : `осталось дней: ${daysLeft}`;
  if (!s.questions.length) return uz ? `• ${s.name}: ${when}, savollar kiritilmagan` : `• ${s.name}: ${when}, вопросы не добавлены`;
  if (!remaining) return uz ? `• ${s.name}: ${when}, hammasi o'zlashtirilgan ✅` : `• ${s.name}: ${when}, всё выучено ✅`;
  const studyDays = daysLeft === 1 ? 1 : daysLeft >= 3 ? daysLeft - 1 : daysLeft;
  const today = daysLeft === 1 ? remaining : Math.ceil(remaining / studyDays);
  return uz ? `• ${s.name}: ${when}, bugun ${today} ta savol` : `• ${s.name}: ${when}, сегодня вопросов: ${today}`;
}

// Lines for one user, or [] when there is nothing to do
export async function planLines(userId: string, lang: 'uz' | 'ru'): Promise<string[]> {
  const [{ data: subjects }, { data: sets }] = await Promise.all([
    admin.from('subjects').select('data').eq('user_id', userId),
    admin.from('study_sets').select('data').eq('user_id', userId),
  ]);
  const today = tashkentToday();
  const lines = (subjects ?? [])
    .map((row: { data: Subject }) => row.data)
    .sort((a, b) => a.examDate.localeCompare(b.examDate))
    .map((s) => subjectLine(s, today, lang))
    .filter((l): l is string => l !== null);

  const now = Date.now();
  const dueCards = (sets ?? [])
    .flatMap((row: { data: StudySet }) => row.data.flashcards ?? [])
    .filter((c) => !c.srs || c.srs.state === 0 || Date.parse(c.srs.due) <= now).length;
  if (dueCards) lines.push(lang === 'uz' ? `• ${dueCards} ta karta takrorlashni kutyapti` : `• карточек к повторению: ${dueCards}`);
  return lines;
}
