import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StudySet, Subject } from '../types';

const saved: { subjects: Subject[]; sets: StudySet[] } = { subjects: [], sets: [] };
vi.mock('./supabase', () => ({ supabase: null }));
vi.mock('./storage', () => ({
  getSubjects: () => saved.subjects,
  getStudySets: () => saved.sets,
  saveSubject: (s: Subject) => saved.subjects.push(s),
  saveStudySet: (s: StudySet) => saved.sets.push(s),
  newId: (p: string) => `${p}-new`,
}));

import { deliver, type LibraryItem } from './library';

const subjectItem = (updated_at: string, questions: Subject['questions']): LibraryItem => ({
  id: 'lib-1',
  kind: 'subject',
  source_id: 's1',
  title: 'Iqtisodiyot',
  audience_all: true,
  community_ids: [],
  published: true,
  updated_at,
  data: { id: 's1', name: 'Iqtisodiyot', examDate: '2027-01-10', examFormat: 'test', createdAt: 1, updatedAt: 1, materials: [], questions } as Subject,
});
const q = (id: string, attempts: Subject['questions'][number]['attempts'] = []) => ({ id, text: id, attempts }) as Subject['questions'][number];

beforeEach(() => {
  saved.subjects = [];
  saved.sets = [];
});

describe('library delivery to students', () => {
  it('copies a published subject once, with a fresh id and no foreign progress', () => {
    const item = subjectItem('v1', [q('a'), q('b')]);
    expect(deliver(item, [], [])).toBe(true);
    expect(saved.subjects).toHaveLength(1);
    expect(saved.subjects[0]).toMatchObject({ id: 'sub-new', libraryId: 'lib-1', libraryUpdatedAt: 'v1' });
    // The same version again does nothing
    expect(deliver(item, saved.subjects, [])).toBe(false);
    expect(saved.subjects).toHaveLength(1);
  });

  it('refreshes a changed subject but keeps the student attempts and id', () => {
    deliver(subjectItem('v1', [q('a'), q('b')]), [], []);
    const own = saved.subjects[0];
    own.questions[0].attempts = [{ at: 5, answer: 'x', score: 80, feedback: '', missing: [] }];

    const changed = subjectItem('v2', [q('a'), q('c')]); // b removed, c added
    expect(deliver(changed, [own], [])).toBe(true);
    const updated = saved.subjects[1];
    expect(updated.id).toBe(own.id);
    expect(updated.libraryUpdatedAt).toBe('v2');
    expect(updated.questions.map((x) => x.id)).toEqual(['a', 'c']);
    expect(updated.questions[0].attempts).toHaveLength(1);
    expect(updated.questions[1].attempts).toHaveLength(0);
  });

  it('keeps score and card schedule when a study set is updated', () => {
    const base = { id: 'set1', title: 'Test', type: 'flashcards', itemCount: 1, createdAt: 1, updatedAt: 1 };
    const item = (updated_at: string): LibraryItem => ({
      id: 'lib-2', kind: 'set', source_id: 'set1', title: 'Test', audience_all: true, community_ids: [], published: true, updated_at,
      data: { ...base, flashcards: [{ id: 'c1', front: 'f', back: 'b' }] } as unknown as StudySet,
    });
    deliver(item('v1'), [], []);
    const own = { ...saved.sets[0], lastScore: 90, flashcards: [{ id: 'c1', front: 'f', back: 'b', srs: { due: 9 }, rating: 3 }] } as unknown as StudySet;

    expect(deliver(item('v2'), [], [own])).toBe(true);
    const updated = saved.sets[1];
    expect(updated.id).toBe(own.id);
    expect(updated.lastScore).toBe(90);
    expect((updated.flashcards?.[0] as unknown as { srs: unknown }).srs).toEqual({ due: 9 });
  });
});
