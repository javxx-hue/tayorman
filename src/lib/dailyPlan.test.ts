import { describe, it, expect } from 'vitest';
import { dailyShare, dailyStudy, limitNewCards, studyDays, TESTS_PER_DAY, NEW_CARDS_PER_DAY } from './dailyPlan';
import { recordAnswer } from './quizProgress';
import type { Flashcard, StudySet, Subject } from '../types';

const now = new Date('2026-12-01T09:00:00');
const subject = (examDate: string): Subject => ({
  id: 'sub-local', name: 'Algebra', examDate, examFormat: 'written', createdAt: 0, updatedAt: 0, materials: [], questions: [], librarySourceId: 'sub-lib-algebra',
});
const quiz = (n: number): StudySet =>
  ({ id: 'quiz', libraryId: 'lib-q', subjectId: 'sub-lib-algebra', type: 'quiz', title: 'T', questions: Array.from({ length: n }, (_, i) => ({ id: `q${i}`, question: '?', options: ['a', 'b'], correctAnswer: 0, hint: '', explanation: '' })) }) as unknown as StudySet;
const card = (id: string, reviewed = false): Flashcard =>
  ({ id, front: id, back: id, ...(reviewed ? { srs: { due: '2026-11-30T00:00:00Z', stability: 1, difficulty: 5, elapsed_days: 0, scheduled_days: 1, learning_steps: 0, reps: 1, lapses: 0, state: 2 } } : {}) }) as Flashcard;
const deck = (cards: Flashcard[]): StudySet => ({ id: 'deck', libraryId: 'lib-c', subjectId: 'sub-lib-algebra', type: 'flashcards', title: 'K', flashcards: cards }) as unknown as StudySet;

describe('studyDays and dailyShare', () => {
  it('keeps the day before the exam free when there are at least 3 days', () => {
    expect(studyDays(10)).toBe(9);
    expect(studyDays(2)).toBe(2);
    expect(studyDays(0)).toBe(0);
  });

  it('spreads the work evenly within limits and never asks for more than is left', () => {
    expect(dailyShare(210, 0, 41, TESTS_PER_DAY)).toBe(6); // 210 / 41 -> 6
    expect(dailyShare(210, 0, 3, TESTS_PER_DAY)).toBe(30); // capped
    expect(dailyShare(20, 0, 30, TESTS_PER_DAY)).toBe(5); // at least 5
    expect(dailyShare(3, 0, 30, TESTS_PER_DAY)).toBe(3); // but not more than is left
    expect(dailyShare(0, 0, 10, NEW_CARDS_PER_DAY)).toBe(0);
  });

  it('does not move today\'s target as today\'s work gets done', () => {
    expect(dailyShare(200, 0, 20, TESTS_PER_DAY)).toBe(dailyShare(190, 10, 20, TESTS_PER_DAY));
  });
});

describe('dailyStudy', () => {
  it('gives today\'s share of tests and new cards, with mistakes and reviews due', () => {
    const q = quiz(100);
    const progress = {
      q0: recordAnswer(undefined, true, now.getTime()), // new today
      q1: recordAnswer(undefined, false, now.getTime() - 3 * 86_400_000), // old mistake, due
    };
    const d = deck([card('a'), card('b'), card('c', true)]);
    const plan = dailyStudy(subject('2026-12-11'), [q, d], () => progress, () => 1, now);
    expect(plan.daysLeft).toBe(10);
    expect(plan.quiz).toMatchObject({ target: 11, done: 1, dueMistakes: 1 }); // (98 unseen + 1 done today) / 9 study days
    expect(plan.cards).toMatchObject({ newTarget: 3, newDone: 1, reviewsDue: 1 });
  });

  it('has nothing to plan once the exam has passed', () => {
    const plan = dailyStudy(subject('2026-11-20'), [quiz(10)], () => ({}), () => 0, now);
    expect(plan.quiz).toBeUndefined();
    expect(plan.cards).toBeUndefined();
  });
});

describe('limitNewCards', () => {
  it('keeps every review and only as many new cards as allowed', () => {
    const q = [card('r1', true), card('n1'), card('n2'), card('r2', true), card('n3')];
    expect(limitNewCards(q, 1).map((c) => c.id)).toEqual(['r1', 'n1', 'r2']);
    expect(limitNewCards(q, 0).map((c) => c.id)).toEqual(['r1', 'r2']);
  });
});
