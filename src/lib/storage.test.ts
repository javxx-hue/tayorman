import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  localDateKey,
  nextStreak,
  saveStudySet,
  getStudySets,
  deleteStudySet,
  saveSubject,
  getSubjects,
  deleteSubject,
  recordQuizCompletion,
  getUserStats,
  initStorage,
} from './storage';
import { StudySet, Subject } from '../types';

describe('nextStreak', () => {
  it('starts at 1 on the very first study day', () => {
    expect(nextStreak('', 0, '2026-11-01')).toBe(1);
  });

  it('adds a day when the last study day was yesterday', () => {
    expect(nextStreak('2026-10-31', 4, '2026-11-01')).toBe(5);
  });

  it('keeps the streak when studying again on the same day', () => {
    expect(nextStreak('2026-11-01', 5, '2026-11-01')).toBe(5);
  });

  it('resets to 1 after a missed day', () => {
    expect(nextStreak('2026-10-29', 9, '2026-11-01')).toBe(1);
  });
});

describe('localDateKey', () => {
  it('uses the local calendar day, zero padded', () => {
    expect(localDateKey(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05');
  });
});

describe('StudySet & Subject Storage Operations', () => {
  const store: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = String(val); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };

  beforeEach(() => {
    mockLocalStorage.clear();
    (global as any).window = {};
    (global as any).localStorage = mockLocalStorage;
  });

  afterEach(() => {
    delete (global as any).window;
    delete (global as any).localStorage;
  });

  it('saves and retrieves study sets', () => {
    const dummySet: StudySet = {
      id: 'set-test-1',
      title: 'Kriptografiya testlari',
      type: 'quiz',
      description: 'Shifrlash algoritmlari',
      createdAt: Date.now(),
      itemCount: 2,
      difficulty: 'hard',
      sourceType: 'text',
      questions: [
        { id: 'q1', question: 'RSA qanday algoritm?', options: ['Asimmetrik', 'Simmetrik'], correctAnswer: 0, hint: '', explanation: '' }
      ],
    };

    saveStudySet(dummySet);
    const sets = getStudySets();
    expect(sets.some((s) => s.id === 'set-test-1')).toBe(true);

    const retrieved = sets.find((s) => s.id === 'set-test-1');
    expect(retrieved?.title).toBe('Kriptografiya testlari');

    deleteStudySet('set-test-1');
    expect(getStudySets().some((s) => s.id === 'set-test-1')).toBe(false);
  });

  it('saves, retrieves and deletes subjects', () => {
    const dummySub: Subject = {
      id: 'sub-test-1',
      name: 'Sun\'iy intellekt',
      examDate: '2026-12-20',
      examFormat: 'test',
      materials: [],
      questions: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    saveSubject(dummySub);
    const subs = getSubjects();
    expect(subs.some((s) => s.id === 'sub-test-1')).toBe(true);

    deleteSubject('sub-test-1');
    expect(getSubjects().some((s) => s.id === 'sub-test-1')).toBe(false);
  });

  it('records quiz completion and updates user stats', () => {
    const set: StudySet = {
      id: 'set-test-stats',
      title: 'Sinov',
      type: 'quiz',
      description: '',
      createdAt: Date.now(),
      itemCount: 10,
      difficulty: 'easy',
      sourceType: 'text',
    };

    saveStudySet(set);
    recordQuizCompletion(80, 10, set);

    const stats = getUserStats();
    expect(stats.quizzesTaken).toBeGreaterThanOrEqual(1);
    expect(stats.averageScore).toBe(80);
    expect(stats.totalStudyMinutes).toBeGreaterThan(0);
  });

  it('migrates legacy tayyorman_* keys to sessiyagatayyorlan_*', () => {
    mockLocalStorage.setItem('tayyorman_study_sets', JSON.stringify([{ id: 'migrated-set', title: 'Eski to\'plam' }]));
    initStorage();

    const sets = getStudySets();
    expect(sets.some((s) => s.id === 'migrated-set')).toBe(true);
  });
});
