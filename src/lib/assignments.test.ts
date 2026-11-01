import { describe, it, expect, vi } from 'vitest';
import type { StudySet, Subject } from '../types';

vi.mock('./supabase', () => ({ supabase: null }));

import { dueInfo, localItem, needsSync, progressOf, type Assignment } from './assignments';

const attempt = (score: number) => ({ at: 1, answer: 'x', score, feedback: '', missing: [] });
const subject = (scores: (number | null)[]): Subject =>
  ({
    id: 's1', name: 'Fan', examDate: '2027-01-01', examFormat: 'test', createdAt: 1, updatedAt: 1, materials: [], libraryId: 'lib-1',
    questions: scores.map((sc, i) => ({ id: `q${i}`, text: `q${i}`, attempts: sc === null ? [] : [attempt(sc)] })),
  }) as unknown as Subject;
const card = (rated: boolean, mastered = false) => ({ id: Math.random().toString(), front: 'f', back: 'b', ...(rated ? { srs: { due: '2026-01-01', stability: mastered ? 100 : 1, difficulty: 5, state: mastered ? 2 : 1, reps: 1, lapses: 0, scheduled_days: mastered ? 60 : 1 } } : {}) });
const set = (over: Partial<StudySet>): StudySet => ({ id: 'set1', title: 'T', type: 'quiz', itemCount: 1, createdAt: 1, updatedAt: 1, libraryId: 'lib-2', ...over }) as StudySet;
const a = (lib: string): Assignment => ({ id: 'a1', title: 'A', note: null, library_item_id: lib, due_at: null, created_at: '2026-01-01' });

describe('assignment progress', () => {
  it('finds the student copy through the library id, subject first', () => {
    expect(localItem(a('lib-1'), [subject([null])], [])?.kind).toBe('subject');
    expect(localItem(a('lib-2'), [], [set({})])?.kind).toBe('set');
    expect(localItem(a('lib-9'), [subject([null])], [set({})])).toBeNull();
  });

  it('subject: new until answered, started while any question is weak, done when all pass', () => {
    expect(progressOf(localItem(a('lib-1'), [subject([null, null])], []))).toEqual({ status: 'new', score: null });
    expect(progressOf(localItem(a('lib-1'), [subject([90, null])], []))).toEqual({ status: 'started', score: 45 });
    expect(progressOf(localItem(a('lib-1'), [subject([90, 40])], []))).toMatchObject({ status: 'started' });
    expect(progressOf(localItem(a('lib-1'), [subject([90, 80])], []))).toEqual({ status: 'done', score: 85 });
    expect(progressOf(localItem(a('lib-1'), [subject([])], []))).toEqual({ status: 'new', score: null });
  });

  it('quiz and exam: done once finished, with the score', () => {
    expect(progressOf(localItem(a('lib-2'), [], [set({})]))).toEqual({ status: 'new', score: null });
    expect(progressOf(localItem(a('lib-2'), [], [set({ lastScore: 0 })]))).toEqual({ status: 'done', score: 0 });
    expect(progressOf(localItem(a('lib-2'), [], [set({ type: 'exam', lastScore: 76 })]))).toEqual({ status: 'done', score: 76 });
  });

  it('flashcards: started after the first rating, done when every card was rated', () => {
    const some = set({ type: 'flashcards', flashcards: [card(true), card(false)] as never });
    const all = set({ type: 'flashcards', flashcards: [card(true), card(true)] as never });
    expect(progressOf(localItem(a('lib-2'), [], [some])).status).toBe('started');
    expect(progressOf(localItem(a('lib-2'), [], [all])).status).toBe('done');
    expect(progressOf(localItem(a('lib-2'), [], [set({ type: 'flashcards', flashcards: [card(false)] as never })])).status).toBe('new');
  });

  it('sends only real changes and never takes a finished assignment back', () => {
    expect(needsSync({ status: 'new', score: null }, undefined)).toBe(false);
    expect(needsSync({ status: 'started', score: 10 }, undefined)).toBe(true);
    expect(needsSync({ status: 'started', score: 10 }, { status: 'started', score: 10 })).toBe(false);
    expect(needsSync({ status: 'started', score: 30 }, { status: 'started', score: 10 })).toBe(true);
    expect(needsSync({ status: 'done', score: 80 }, { status: 'started', score: 60 })).toBe(true);
    expect(needsSync({ status: 'started', score: 20 }, { status: 'done', score: 90 })).toBe(false);
    expect(needsSync({ status: 'done', score: 95 }, { status: 'done', score: 90 })).toBe(true);
  });
});

describe('deadline', () => {
  const now = Date.UTC(2026, 10, 1, 12, 0, 0);
  it('counts days and hours, and flags a missed deadline', () => {
    expect(dueInfo('2026-11-04T12:00:00Z', now)).toMatchObject({ overdue: false, days: 3 });
    expect(dueInfo('2026-11-01T17:30:00Z', now)).toMatchObject({ overdue: false, days: 0, hours: 6 });
    expect(dueInfo('2026-11-01T11:00:00Z', now)).toMatchObject({ overdue: true, days: 0, hours: 0 });
  });
});
