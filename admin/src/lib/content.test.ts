import { describe, it, expect } from 'vitest';
import type { ExamQuestion, QuizQuestion, StudySet } from '../../../src/types';
import { checkCards, checkQuiz, copyOf, listAsText, questionsAsText, questionsKeepingAnswers } from './content';
import { parseQuestionList } from '../../../src/lib/prep';

const q = (over: Partial<QuizQuestion> = {}): QuizQuestion => ({ id: 'q1', question: 'Savol?', options: ['A', 'B', 'C', 'D'], correctAnswer: 1, hint: '', explanation: '', ...over });

describe('checkQuiz', () => {
  it('accepts a complete question and keeps the right answer pointing at the same text', () => {
    const r = checkQuiz([q({ options: ['A', '', 'C', 'D'], correctAnswer: 2 })]);
    expect(r).toMatchObject({ ok: true });
    if (r.ok) {
      expect(r.value[0].options).toEqual(['A', 'C', 'D']); // the blank one is dropped
      expect(r.value[0].options[r.value[0].correctAnswer]).toBe('C');
    }
  });

  it('refuses what would teach students something wrong or show a broken test', () => {
    expect(checkQuiz([])).toMatchObject({ ok: false });
    expect(checkQuiz([q({ question: '  ' })])).toMatchObject({ ok: false, error: "1-savol matni bo'sh." });
    expect(checkQuiz([q({ options: ['A', '', '', ''] })])).toMatchObject({ ok: false });
    // the marked answer is a blank option
    expect(checkQuiz([q(), q({ id: 'q2', options: ['A', 'B', '', 'D'], correctAnswer: 2 })])).toMatchObject({ ok: false, error: expect.stringContaining('2-savol') });
    expect(checkQuiz([q({ correctAnswer: 9 })])).toMatchObject({ ok: false });
  });
});

describe('checkCards', () => {
  it('drops half-filled cards and needs at least one full one', () => {
    const r = checkCards([{ id: 'a', front: ' term ', back: 'def' }, { id: 'b', front: 'x', back: '' }]);
    expect(r).toMatchObject({ ok: true, value: [{ id: 'a', front: 'term', back: 'def' }] });
    expect(checkCards([{ id: 'b', front: 'x', back: '' }])).toMatchObject({ ok: false });
  });
});

describe('subject questions as text', () => {
  const existing: ExamQuestion[] = [
    { id: 'q-a', text: 'Bozor nima?', attempts: [], modelAnswer: { summary: 's', keyPoints: [] } as never },
    { id: 'q-b', text: 'Talab qonuni', attempts: [] },
  ];
  it('writes a numbered list and reads it back', () => {
    expect(questionsAsText(existing)).toBe('1. Bozor nima?\n2. Talab qonuni');
  });
  it('keeps id and prepared answer of unchanged questions, creates new ones for new text', () => {
    const next = questionsKeepingAnswers('1. Bozor nima?\n2. Taklif qonuni\n3. Narx nima?', existing);
    expect(next.map((x) => x.text)).toEqual(['Bozor nima?', 'Taklif qonuni', 'Narx nima?']);
    expect(next[0]).toBe(existing[0]);
    expect(next[1].id).not.toBe('q-b'); // the text changed, so it is a different question
    expect(next[1].attempts).toEqual([]);
  });
});

describe('listAsText', () => {
  it('numbers from 1 and reads back as the same questions', () => {
    const list = ['Bozor nima?', 'Talab qonuni nima?'];
    expect(listAsText(list)).toBe('1. Bozor nima?\n2. Talab qonuni nima?');
    expect(parseQuestionList(listAsText(list))).toEqual(list);
  });
  it('renumbers a mix of old and new questions instead of leaving two styles', () => {
    const merged = listAsText([...parseQuestionList('5. Eski savol bir?\n9. Eski savol ikki?'), 'Yangi savol?']);
    expect(merged).toBe('1. Eski savol bir?\n2. Eski savol ikki?\n3. Yangi savol?');
  });
});

describe('copyOf', () => {
  it('gets a new id and a marked name, original untouched', () => {
    const set = { id: 'set-1', title: 'Matematika', type: 'quiz' } as StudySet;
    const copy = copyOf(set);
    expect(copy.id).not.toBe('set-1');
    expect(copy.title).toBe('Matematika (nusxa)');
    expect(set.title).toBe('Matematika');
  });
});
