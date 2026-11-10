// How much of a subject's tests and flashcards to do today, spread over the days left until the exam.
// The day's share is worked out from what was still to do this morning, so doing today's work never moves today's
// target. The day before the exam is left for review when there is room for it (the same rule as the question plan).
import { Flashcard, StudySet, Subject } from '../types';
import { daysUntil, planSubject, setsOfSubject } from './prep';
import { allocate, COST, getDailyMinutes, type Allowance, type Need } from './budget';
import { isDue, isNew } from './srs';
import { getProgress, overview, progressKey, type SetProgress } from './quizProgress';
import { localDateKey } from './storage';

export const TESTS_PER_DAY = { min: 5, max: 30 };
export const NEW_CARDS_PER_DAY = { min: 3, max: 20 };
// A deck that is not part of any subject still should not throw all its new cards at once
export const DEFAULT_NEW_CARDS = 20;

const clamp = (n: number, { min, max }: { min: number; max: number }) => Math.min(max, Math.max(min, n));

export function studyDays(daysLeft: number): number {
  if (daysLeft <= 0) return 0;
  return daysLeft >= 3 ? daysLeft - 1 : daysLeft;
}

// Spread "left" (plus what was already done today) over the days, within limits, never more than there is
export function dailyShare(left: number, doneToday: number, days: number, limits: { min: number; max: number }): number {
  const total = left + doneToday;
  if (days <= 0 || total <= 0) return 0;
  return Math.min(total, clamp(Math.ceil(total / days), limits));
}

export interface DailyStudy {
  daysLeft: number;
  quiz?: { set: StudySet; target: number; done: number; dueMistakes: number };
  cards?: { set: StudySet; newTarget: number; newDone: number; reviewsDue: number };
}

export function dailyStudy(
  subject: Subject,
  sets: StudySet[],
  progressOf: (set: StudySet) => SetProgress,
  newCardsDoneToday: (set: StudySet) => number,
  now: Date = new Date()
): DailyStudy {
  const daysLeft = daysUntil(subject.examDate, localDateKey(now));
  const days = studyDays(daysLeft);
  const own = setsOfSubject(subject, sets);
  const out: DailyStudy = { daysLeft };

  const quizSet = own.find((s) => s.type === 'quiz' && (s.questions?.length ?? 0) > 0);
  if (quizSet && days > 0) {
    const progress = progressOf(quizSet);
    const ov = overview(quizSet.questions ?? [], progress, now.getTime());
    const today = localDateKey(now);
    // first answered today = seen once, and that once was today
    const newToday = Object.values(progress).filter((s) => s.seen === 1 && localDateKey(new Date(s.at)) === today).length;
    const unseen = ov.total - ov.seen;
    out.quiz = { set: quizSet, target: dailyShare(unseen, newToday, days, TESTS_PER_DAY), done: newToday, dueMistakes: ov.dueMistakes };
  }

  const cardSet = own.find((s) => s.type === 'flashcards' && (s.flashcards?.length ?? 0) > 0);
  if (cardSet && days > 0) {
    const cards = cardSet.flashcards ?? [];
    const newDone = newCardsDoneToday(cardSet);
    out.cards = {
      set: cardSet,
      newTarget: dailyShare(cards.filter(isNew).length, newDone, days, NEW_CARDS_PER_DAY),
      newDone,
      reviewsDue: cards.filter((c) => !isNew(c) && isDue(c, now)).length,
    };
  }
  return out;
}

// How many new cards of a deck may still be started today: the deck's subject's part of the day's budget
export function newCardsLeftToday(set: StudySet, subjects: Subject[], sets: StudySet[], doneToday: number, now = new Date()): number {
  const subject = subjects.find((s) => setsOfSubject(s, sets).some((x) => x.id === set.id));
  if (!subject) return Math.max(0, DEFAULT_NEW_CARDS - doneToday);
  const budget = todayBudget(subjects, sets, (s) => getProgress(progressKey(s)), (s) => (s.id === set.id ? doneToday : newCardsToday(s, now)), getDailyMinutes(), now);
  const allowed = budget.bySubject[subject.id];
  // exam passed or no plan: the default allowance
  return allowed ? allowed.newCards : Math.max(0, DEFAULT_NEW_CARDS - doneToday);
}

// ---------------------------------------------------------------- new cards started today (this phone)
const KEY = 'sessiyagatayyorlan_new_cards_today';
type Counter = { date: string; counts: Record<string, number> };

function readCounter(now: Date): Counter {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Counter | null;
    if (c && c.date === localDateKey(now)) return c;
  } catch {
    /* unreadable: start the day again */
  }
  return { date: localDateKey(now), counts: {} };
}

export const newCardsToday = (set: StudySet, now = new Date()): number => readCounter(now).counts[progressKey(set)] ?? 0;

export function countNewCard(set: StudySet, now = new Date()): void {
  const c = readCounter(now);
  const key = progressKey(set);
  c.counts[key] = (c.counts[key] ?? 0) + 1;
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* storage blocked: the cap simply does not apply */
  }
}

// The cards a review sitting shows: every review that is due, and new cards only up to today's allowance
export function limitNewCards(queue: Flashcard[], allowance: number): Flashcard[] {
  let left = allowance;
  return queue.filter((c) => (isNew(c) ? left-- > 0 : true));
}

// ---------------------------------------------------------------- one budget for the whole day
export interface DayBudget {
  minutes: number; // the student's daily minutes
  planned: number; // minutes of work that fits today
  wanted: number; // minutes all subjects would have liked today
  bySubject: Record<string, Allowance>;
}

export function todayBudget(
  subjects: Subject[],
  sets: StudySet[],
  progressOf: (set: StudySet) => SetProgress,
  newCardsDoneToday: (set: StudySet) => number,
  minutes: number,
  now: Date = new Date()
): DayBudget {
  const today = localDateKey(now);
  const needs: Need[] = subjects
    .map((subject) => {
      const plan = planSubject(subject, today);
      const study = dailyStudy(subject, sets, progressOf, newCardsDoneToday, now);
      if (plan.daysLeft < 0) return null;
      return {
        id: subject.id,
        questions: plan.today.length,
        tests: study.quiz ? Math.max(study.quiz.target - study.quiz.done, 0) : 0,
        mistakes: study.quiz?.dueMistakes ?? 0,
        newCards: study.cards ? Math.max(study.cards.newTarget - study.cards.newDone, 0) : 0,
        reviews: study.cards?.reviewsDue ?? 0,
      };
    })
    .filter((n): n is Need => n !== null);
  const bySubject = allocate(needs, minutes);
  const planned = Object.values(bySubject).reduce((m, a) => m + a.minutes, 0);
  const wanted = Math.round(
    needs.reduce((m, n) => m + n.questions * COST.question + n.tests * COST.test + n.mistakes * COST.mistake + n.newCards * COST.newCard + n.reviews * COST.review, 0)
  );
  return { minutes, planned, wanted, bySubject };
}

// Today's budget with what this phone knows (test progress, new cards started today, the student's minutes)
export const currentBudget = (subjects: Subject[], sets: StudySet[], now = new Date()): DayBudget =>
  todayBudget(subjects, sets, (s) => getProgress(progressKey(s)), (s) => newCardsToday(s, now), getDailyMinutes(), now);
