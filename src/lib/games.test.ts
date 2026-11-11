import { describe, it, expect } from 'vitest';
import { challengeQuestions, duelQuestions, duelState, levelOf, libraryQuestions, type Duel } from './games';
import type { StudySet } from '../types';

const set = (libraryId: string | undefined, n: number, type: StudySet['type'] = 'quiz'): StudySet =>
  ({
    id: `local-${libraryId}`,
    libraryId,
    type,
    title: 'T',
    questions: Array.from({ length: n }, (_, i) => ({ id: `${libraryId}-q${i}`, question: '?', options: ['a', 'b'], correctAnswer: 0, hint: '', explanation: '' })),
  }) as unknown as StudySet;

describe('levelOf', () => {
  it('starts at level 1 and moves up at the thresholds', () => {
    expect(levelOf(0, 'uz')).toMatchObject({ level: 1, name: 'Yangi boshlovchi', from: 0, to: 100, progress: 0 });
    expect(levelOf(99, 'uz').level).toBe(1);
    expect(levelOf(100, 'uz')).toMatchObject({ level: 2, from: 100, to: 250, progress: 0 });
    expect(levelOf(175, 'uz').progress).toBe(50);
  });

  it('stops at the top level', () => {
    expect(levelOf(99999, 'ru')).toMatchObject({ level: 10, name: 'Легенда', to: null, progress: 100 });
  });
});

describe('challengeQuestions', () => {
  const sets = [set('lib-a', 20), set('lib-b', 20), set(undefined, 20), set('lib-c', 5, 'flashcards')];

  it('uses only library test questions', () => {
    expect(libraryQuestions(sets)).toHaveLength(40);
  });

  it('is the same for the same group and day, whatever order the sets are in', () => {
    const one = challengeQuestions(sets, 'g1', '2026-12-01').map((p) => p.question.id);
    const two = challengeQuestions([...sets].reverse(), 'g1', '2026-12-01').map((p) => p.question.id);
    expect(one).toHaveLength(5);
    expect(two).toEqual(one);
  });

  it('changes from day to day and from group to group', () => {
    const base = challengeQuestions(sets, 'g1', '2026-12-01').map((p) => p.question.id).join();
    expect(challengeQuestions(sets, 'g1', '2026-12-02').map((p) => p.question.id).join()).not.toBe(base);
    expect(challengeQuestions(sets, 'g2', '2026-12-01').map((p) => p.question.id).join()).not.toBe(base);
  });
});

describe('duels', () => {
  it('a duel takes a few distinct questions of one set', () => {
    const qs = duelQuestions(set('lib-a', 20), 5);
    expect(qs).toHaveLength(5);
    expect(new Set(qs.map((q) => q.id)).size).toBe(5);
  });

  const duel = (over: Partial<Duel>): Duel => ({
    id: 'd', community_id: 'g', set_key: 'k', question_ids: [], created_at: new Date('2026-12-01T10:00:00Z').toISOString(), finished_at: null,
    i_challenged: true, my_score: 3, their_score: null, their_name: 'X', ...over,
  });
  const now = Date.parse('2026-12-01T12:00:00Z');

  it('says whose turn it is and how it ended', () => {
    expect(duelState(duel({ my_score: null, i_challenged: false, their_score: 4 }), now)).toBe('my-turn');
    expect(duelState(duel({}), now)).toBe('waiting');
    expect(duelState(duel({}), now + 2 * 86_400_000)).toBe('expired');
    expect(duelState(duel({ their_score: 2 }), now)).toBe('won');
    expect(duelState(duel({ their_score: 4 }), now)).toBe('lost');
    expect(duelState(duel({ their_score: 3 }), now)).toBe('draw');
  });
});
