// Spaced repetition on top of FSRS (the scheduler Anki uses).
// Card state is stored on each Flashcard as plain JSON so it survives
// localStorage now and the Supabase jsonb column later.
import { createEmptyCard, fsrs, Card, Grade, Rating, State } from 'ts-fsrs';
import { Flashcard, SrsState } from '../types';
import { Language } from './i18n';

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

// No fuzz: the interval shown under each button must match what gets scheduled
const scheduler = fsrs({ enable_fuzz: false });

const GRADES: Record<ReviewRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

function toCard(srs: SrsState | undefined, now: Date): Card {
  if (!srs) return createEmptyCard(now);
  return {
    ...srs,
    due: new Date(srs.due),
    last_review: srs.last_review ? new Date(srs.last_review) : undefined,
  };
}

function fromCard(card: Card): SrsState {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review?.toISOString(),
  };
}

export function reviewCard(card: Flashcard, rating: ReviewRating, now: Date = new Date()): Flashcard {
  const { card: next } = scheduler.next(toCard(card.srs, now), now, GRADES[rating]);
  return { ...card, rating, srs: fromCard(next) };
}

export function isNew(card: Flashcard): boolean {
  return !card.srs || card.srs.state === State.New;
}

export function isDue(card: Flashcard, now: Date = new Date()): boolean {
  return isNew(card) || new Date(card.srs!.due).getTime() <= now.getTime();
}

// "Mastered" = graduated out of learning into long-term review
export function isMastered(card: Flashcard): boolean {
  return card.srs?.state === State.Review;
}

// Cards to study now: overdue reviews first (oldest due first), then new cards in deck order
export function dueQueue(cards: Flashcard[], now: Date = new Date()): Flashcard[] {
  const reviews = cards
    .filter((c) => !isNew(c) && isDue(c, now))
    .sort((a, b) => new Date(a.srs!.due).getTime() - new Date(b.srs!.due).getTime());
  const fresh = cards.filter(isNew);
  return [...reviews, ...fresh];
}

export function nextDueDate(cards: Flashcard[]): Date | null {
  const dates = cards.filter((c) => !isNew(c)).map((c) => new Date(c.srs!.due).getTime());
  return dates.length ? new Date(Math.min(...dates)) : null;
}

// A card answered again/hard comes back within minutes, so it stays in the current session
const SESSION_REQUEUE_MS = 20 * 60 * 1000;

export function shouldRequeue(card: Flashcard, now: Date = new Date()): boolean {
  return !!card.srs && new Date(card.srs.due).getTime() - now.getTime() <= SESSION_REQUEUE_MS;
}

export function formatInterval(ms: number, lang: Language): string {
  const uz = lang === 'uz';
  if (ms < 60000) return uz ? '<1 daq' : '<1 мин';
  const min = Math.round(ms / 60000);
  if (min < 60) return uz ? `${min} daq` : `${min} мин`;
  const hours = Math.round(min / 60);
  if (hours < 24) return uz ? `${hours} soat` : `${hours} ч`;
  const days = Math.round(hours / 24);
  if (days < 31) return uz ? `${days} kun` : `${days} дн.`;
  const months = Math.round(days / 30);
  if (months < 12) return uz ? `${months} oy` : `${months} мес.`;
  return uz ? `${(days / 365).toFixed(1)} yil` : `${(days / 365).toFixed(1)} г.`;
}

// Interval each button would schedule, shown under the rating buttons like Anki does
export function previewIntervals(card: Flashcard, now: Date = new Date()): Record<ReviewRating, number> {
  const current = toCard(card.srs, now);
  const result = {} as Record<ReviewRating, number>;
  (Object.keys(GRADES) as ReviewRating[]).forEach((r) => {
    result[r] = scheduler.next(current, now, GRADES[r]).card.due.getTime() - now.getTime();
  });
  return result;
}
