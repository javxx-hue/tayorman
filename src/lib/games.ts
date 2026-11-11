// XP, the daily challenge and duels. XP is earned only here (the challenge and duels); the server keeps the
// ledger and decides every prize, the app only shows it and sends results.
import { QuizQuestion, StudySet } from '../types';
import { supabase } from './supabase';
import { localDateKey } from './storage';
import { Language, tr } from './i18n';

export const CHALLENGE_SIZE = 5;
export const DUEL_SIZE = 5;

// ---------------------------------------------------------------- levels
const LEVELS = [0, 100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000];
const NAMES: [string, string][] = [
  ['Yangi boshlovchi', 'Новичок'],
  ['Izlanuvchi', 'Ищущий'],
  ['Bilimdon', 'Знаток'],
  ['Faol talaba', 'Активный студент'],
  ['Usta', 'Мастер'],
  ['Ekspert', 'Эксперт'],
  ['Professor', 'Профессор'],
  ['Akademik', 'Академик'],
  ['Daho', 'Гений'],
  ['Afsona', 'Легенда'],
];

export interface Level {
  level: number; // 1-based
  name: string;
  from: number; // XP where this level starts
  to: number | null; // XP of the next level (null at the top)
  progress: number; // 0-100 towards the next level
}

export function levelOf(xp: number, lang: Language): Level {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1]) i++;
  const from = LEVELS[i];
  const to = LEVELS[i + 1] ?? null;
  return {
    level: i + 1,
    name: lang === 'uz' ? NAMES[i][0] : NAMES[i][1],
    from,
    to,
    progress: to === null ? 100 : Math.round(((xp - from) / (to - from)) * 100),
  };
}

// ---------------------------------------------------------------- picking questions
// FNV-1a: a small, stable hash, so every phone of a group picks the same questions for the same day
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface Picked {
  setKey: string;
  question: QuizQuestion;
}

// Library test questions of the student's sets (only these are the same for the whole group)
export function libraryQuestions(sets: StudySet[]): Picked[] {
  return sets
    .filter((s) => s.libraryId && (s.type === 'quiz' || s.type === 'exam'))
    .flatMap((s) => (s.questions ?? []).map((question) => ({ setKey: s.libraryId as string, question })));
}

// Today's challenge: the same few questions for everyone in a group on a day
export function challengeQuestions(sets: StudySet[], groupId: string, day: string, size = CHALLENGE_SIZE): Picked[] {
  return libraryQuestions(sets)
    .map((p) => ({ p, order: hash(`${day}|${groupId}|${p.setKey}|${p.question.id}`) }))
    .sort((a, b) => a.order - b.order)
    .slice(0, size)
    .map((x) => x.p);
}

// A duel's questions: random ones from one test set
export function duelQuestions(set: StudySet, size = DUEL_SIZE, random: () => number = Math.random): QuizQuestion[] {
  return [...(set.questions ?? [])]
    .map((q) => ({ q, r: random() }))
    .sort((a, b) => a.r - b.r)
    .slice(0, size)
    .map((x) => x.q);
}

export const today = (): string => localDateKey();

// ---------------------------------------------------------------- server
export interface Duel {
  id: string;
  community_id: string;
  set_key: string;
  question_ids: string[];
  created_at: string;
  finished_at: string | null;
  i_challenged: boolean;
  my_score: number | null;
  their_score: number | null;
  their_name: string;
}

export interface RatingRow {
  user_id: string;
  first_name: string;
  xp: number;
}

// What a duel needs from me right now
export type DuelState = 'my-turn' | 'waiting' | 'won' | 'lost' | 'draw' | 'expired';
export function duelState(d: Duel, now = Date.now()): DuelState {
  if (d.my_score === null) return 'my-turn';
  if (d.their_score === null) return now - Date.parse(d.created_at) > 86_400_000 ? 'expired' : 'waiting';
  if (d.my_score === d.their_score) return 'draw';
  return d.my_score > d.their_score ? 'won' : 'lost';
}

export const duelLabel = (s: DuelState, lang: Language): string =>
  ({
    'my-turn': tr(lang, 'Sizning navbatingiz', 'Ваш ход'),
    waiting: tr(lang, 'Raqib javobini kutyapmiz', 'Ждём соперника'),
    won: tr(lang, "G'alaba", 'Победа'),
    lost: tr(lang, "Mag'lubiyat", 'Поражение'),
    draw: tr(lang, 'Durang', 'Ничья'),
    expired: tr(lang, "Raqib o'ynamadi", 'Соперник не сыграл'),
  })[s];

// Friendly words for the server's refusals
export function gameError(e: unknown, lang: Language): string {
  const m = String((e as { message?: string })?.message ?? e);
  if (m.includes('no opponent')) return tr(lang, "Guruhingizda hozircha raqib yo'q.", 'В группе пока нет соперника.');
  if (m.includes('too many duels')) return tr(lang, "Bugun juda ko'p duel boshladingiz. Ertaga davom eting.", 'Сегодня слишком много дуэлей. Продолжите завтра.');
  if (m.includes('already played or expired')) return tr(lang, "Bu duel tugagan yoki muddati o'tgan.", 'Дуэль окончена или истекла.');
  if (m.includes('not in this group')) return tr(lang, "Siz bu guruhda emassiz.", 'Вы не в этой группе.');
  return tr(lang, "Xatolik yuz berdi, keyinroq urinib ko'ring.", 'Произошла ошибка, попробуйте позже.');
}

const client = () => {
  if (!supabase) throw new Error('offline');
  return supabase;
};

export async function myGroup(userId: string): Promise<{ id: string; name: string } | null> {
  const { data, error } = await client().from('community_members').select('communities(id, name)').eq('user_id', userId).order('joined_at').limit(1);
  if (error) throw error;
  const row = data?.[0] as unknown as { communities: { id: string; name: string } | null } | undefined;
  return row?.communities ?? null;
}

export async function myXp(userId: string): Promise<number> {
  const { data, error } = await client().rpc('xp_of', { p_user: userId });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function submitChallenge(day: string, correct: number, total: number): Promise<number> {
  const { data, error } = await client().rpc('submit_challenge', { p_day: day, p_correct: correct, p_total: total });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function startDuel(groupId: string, setKey: string, questionIds: string[]): Promise<{ id: string }> {
  const { data, error } = await client().rpc('start_duel', { p_community: groupId, p_set_key: setKey, p_questions: questionIds });
  if (error) throw error;
  return data as { id: string };
}

export async function submitDuel(duelId: string, correct: number): Promise<void> {
  const { error } = await client().rpc('submit_duel', { p_duel: duelId, p_correct: correct });
  if (error) throw error;
}

export async function myDuels(): Promise<Duel[]> {
  await client().rpc('settle_expired_duels');
  const { data, error } = await client().rpc('my_duels');
  if (error) throw error;
  return (data ?? []) as Duel[];
}

export async function weeklyRating(groupId: string): Promise<RatingRow[]> {
  const { data, error } = await client().rpc('group_leaderboard', { p_community: groupId, p_days: 7 });
  if (error) throw error;
  return (data ?? []) as RatingRow[];
}

// Today's challenge result on this phone, so the card shows it without asking the server
const CHALLENGE_KEY = 'sessiyagatayyorlan_challenge';
export function challengeDone(day: string): { correct: number; total: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(CHALLENGE_KEY) ?? 'null') as { day: string; correct: number; total: number } | null;
    return v && v.day === day ? { correct: v.correct, total: v.total } : null;
  } catch {
    return null;
  }
}
export function rememberChallenge(day: string, correct: number, total: number): void {
  try {
    localStorage.setItem(CHALLENGE_KEY, JSON.stringify({ day, correct, total }));
  } catch {
    /* blocked storage: the card asks again, the server still pays only once */
  }
}
