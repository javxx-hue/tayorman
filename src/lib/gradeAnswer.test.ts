import { describe, it, expect, vi, beforeEach } from 'vitest';

const reply = vi.hoisted(() => ({ text: '' }));
vi.mock('./ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ai')>()),
  geminiGenerate: vi.fn(async () => reply.text),
}));

import { gradeAnswer } from './prep';
import { GenerationError } from './ai';
import type { ExamQuestion, Subject } from '../types';

const question = { id: 'q1', text: 'LAN nima?', modelAnswer: { summary: 'Lokal tarmoq.', keyPoints: ['Kichik hudud'], sources: [] }, attempts: [] } as ExamQuestion;
const subject = { id: 's1', name: 'Tarmoqlar', examFormat: 'written', materials: [], questions: [question] } as unknown as Subject;

describe('gradeAnswer', () => {
  beforeEach(() => {
    reply.text = '';
  });

  it('grades a real answer, even a short one', async () => {
    reply.text = '{"answered": true, "score": 40, "feedback": "Qisqa.", "missing": ["Kichik hudud"]}';
    const attempt = await gradeAnswer(subject, question, 'Lokal', 'uz');
    expect(attempt).toMatchObject({ answer: 'Lokal', score: 40, missing: ['Kichik hudud'] });
  });

  it('refuses a text the grader calls "not an answer", so nothing is saved', async () => {
    reply.text = '{"answered": false, "score": 0, "feedback": "", "missing": []}';
    const err = await gradeAnswer(subject, question, 'hygyuyugyugtygu', 'uz').catch((e) => e);
    expect(err).toBeInstanceOf(GenerationError);
    expect((err as GenerationError).code).toBe('NOT_AN_ANSWER');
  });
});
