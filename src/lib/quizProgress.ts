// What a student has done with the questions of a test set, one small record per question.
// It is kept apart from the set itself on purpose: a set holds hundreds of questions, and rewriting (and syncing)
// all of it after every answer would be slow on a phone and heavy on the free database plan.
//
// Mistakes come back on a schedule: a wrong answer returns the question the next day, and each later right answer
// pushes it further out (3 days, then 7). After that it counts as overcome.
import { localDateKey } from './storage';

export interface QStat {
  seen: number; // times answered
  wrong: number; // times answered wrong
  right: boolean; // was the latest answer right
  at: number; // when it was last answered (ms)
  box: number; // after a wrong answer 0, then +1 for each later right answer
  due: number; // when a mistake should come back (ms)
}
export type SetProgress = Record<string, QStat>;

export const MASTERED_BOX = 3;
const DAY = 86_400_000;
// When a mistake comes back after reaching this box
const GAP_AFTER_BOX: Record<number, number> = { 0: 1 * DAY, 1: 3 * DAY, 2: 7 * DAY };

export function recordAnswer(prev: QStat | undefined, correct: boolean, now: number): QStat {
  const base: QStat = prev ?? { seen: 0, wrong: 0, right: false, at: 0, box: MASTERED_BOX, due: 0 };
  const seen = base.seen + 1;
  if (!correct) return { seen, wrong: base.wrong + 1, right: false, at: now, box: 0, due: now + GAP_AFTER_BOX[0] };
  if (base.wrong === 0 || base.box >= MASTERED_BOX) return { ...base, seen, right: true, at: now };
  const box = base.box + 1;
  return { ...base, seen, right: true, at: now, box, due: box >= MASTERED_BOX ? 0 : now + GAP_AFTER_BOX[box] };
}

// A question the student got wrong and has not yet overcome
export const isMistake = (s: QStat | undefined): boolean => !!s && s.wrong > 0 && s.box < MASTERED_BOX;
export const isMistakeDue = (s: QStat | undefined, now: number): boolean => !!s && isMistake(s) && s.due <= now;

export type PickMode = 'new' | 'mistakes' | 'mixed';
export interface PickOptions {
  mode: PickMode;
  count: number;
  topic?: number | null;
  now?: number;
}

// The questions for one sitting. "new" starts with what was never answered, "mistakes" is only questions answered
// wrong before (those due first), "mixed" brings a third of them back between new ones. Never longer than asked.
export function pickQuestions<Q extends { id: string; topic?: number }>(questions: Q[], progress: SetProgress, opts: PickOptions): Q[] {
  const now = opts.now ?? Date.now();
  const pool = opts.topic == null ? questions : questions.filter((q) => q.topic === opts.topic);
  const unseen = pool.filter((q) => !progress[q.id]);
  const dueMistakes = pool.filter((q) => isMistakeDue(progress[q.id], now)).sort((a, b) => progress[a.id].due - progress[b.id].due);
  const laterMistakes = pool.filter((q) => isMistake(progress[q.id]) && !isMistakeDue(progress[q.id], now)).sort((a, b) => progress[b.id].wrong - progress[a.id].wrong);
  const known = pool.filter((q) => progress[q.id] && !isMistake(progress[q.id])).sort((a, b) => progress[a.id].at - progress[b.id].at);

  let order: Q[];
  if (opts.mode === 'mistakes') order = [...dueMistakes, ...laterMistakes];
  else if (opts.mode === 'mixed') {
    const back = dueMistakes.slice(0, Math.ceil(opts.count / 3));
    order = [...back, ...unseen, ...dueMistakes.slice(back.length), ...laterMistakes, ...known];
  } else order = [...unseen, ...dueMistakes, ...laterMistakes, ...known];
  return order.slice(0, Math.max(0, opts.count));
}

export interface TopicSummary {
  no: number;
  name: string;
  total: number;
  seen: number;
  mistakes: number; // not yet overcome
  accuracy: number | null; // % of the answered questions whose latest answer was right; null until anything is answered
}

export function topicSummaries(questions: { id: string; topic?: number }[], topics: { no: number; name: string }[], progress: SetProgress): TopicSummary[] {
  return topics.map((t) => {
    const qs = questions.filter((q) => q.topic === t.no);
    const stats = qs.map((q) => progress[q.id]).filter((s): s is QStat => !!s);
    const right = stats.filter((s) => s.right).length;
    return {
      no: t.no,
      name: t.name,
      total: qs.length,
      seen: stats.length,
      mistakes: stats.filter((s) => isMistake(s)).length,
      accuracy: stats.length ? Math.round((right / stats.length) * 100) : null,
    };
  });
}

// Topics to work on first: answered enough to judge, weakest first, then the ones with the most open mistakes
export function weakTopics(summaries: TopicSummary[], limit = 3, minSeen = 3): TopicSummary[] {
  return summaries
    .filter((s) => s.seen >= minSeen && (s.mistakes > 0 || (s.accuracy ?? 100) < 70))
    .sort((a, b) => (a.accuracy ?? 100) - (b.accuracy ?? 100) || b.mistakes - a.mistakes)
    .slice(0, limit);
}

export interface Overview {
  total: number;
  seen: number;
  mistakes: number;
  dueMistakes: number;
  accuracy: number | null;
  answeredToday: number;
}

export function overview(questions: { id: string }[], progress: SetProgress, now = Date.now()): Overview {
  const stats = questions.map((q) => progress[q.id]).filter((s): s is QStat => !!s);
  const today = localDateKey(new Date(now));
  return {
    total: questions.length,
    seen: stats.length,
    mistakes: stats.filter((s) => isMistake(s)).length,
    dueMistakes: stats.filter((s) => isMistakeDue(s, now)).length,
    accuracy: stats.length ? Math.round((stats.filter((s) => s.right).length / stats.length) * 100) : null,
    answeredToday: stats.filter((s) => localDateKey(new Date(s.at)) === today).length,
  };
}

// Two copies of the same set's progress (this phone and the cloud): per question the later answer decides,
// counts never go down
export function mergeProgress(a: SetProgress, b: SetProgress): SetProgress {
  const out: SetProgress = { ...a };
  for (const [id, sb] of Object.entries(b)) {
    const sa = a[id];
    if (!sa) {
      out[id] = sb;
      continue;
    }
    const newer = sb.at > sa.at ? sb : sa;
    out[id] = { ...newer, seen: Math.max(sa.seen, sb.seen), wrong: Math.max(sa.wrong, sb.wrong) };
  }
  return out;
}

// ---------------------------------------------------------------- storage (this phone)
const KEY = 'sessiyagatayyorlan_quiz_progress';
type All = Record<string, SetProgress>;

// Library sets are identified by their library id, a student's own sets by their local id
export const progressKey = (set: { id: string; libraryId?: string }): string => set.libraryId ?? set.id;

function readAll(): All {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as All) : {};
  } catch {
    return {};
  }
}

const listeners = new Set<(setKey: string) => void>();
// Called after every local change, with the key of the set that changed (sync listens here)
export function onProgressChange(fn: (setKey: string) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getProgress = (setKey: string): SetProgress => readAll()[setKey] ?? {};
export const getAllProgress = (): All => readAll();

export function saveProgress(setKey: string, progress: SetProgress, opts: { fromSync?: boolean } = {}): void {
  try {
    const all = readAll();
    all[setKey] = progress;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch (e) {
    console.warn('quiz progress not saved', e); // storage full or blocked: the quiz still works, it just is not remembered
    return;
  }
  if (!opts.fromSync) listeners.forEach((fn) => fn(setKey));
}

// Writes one sitting's answers
export function recordAnswers(setKey: string, answers: { id: string; correct: boolean }[], now = Date.now()): SetProgress {
  const progress = { ...getProgress(setKey) };
  for (const a of answers) progress[a.id] = recordAnswer(progress[a.id], a.correct, now);
  saveProgress(setKey, progress);
  return progress;
}
