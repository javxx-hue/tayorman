import { describe, it, expect } from 'vitest';
import { boardAskPrompt, parseBoardAnswer } from './boardAi';
import type { ExamQuestion } from '../types';

const question = { id: 'q1', text: 'Fotosintez nima?', modelAnswer: { summary: "O'simliklar quyosh nuridan oziq hosil qiladi.", keyPoints: ['Xlorofill'] } } as unknown as ExamQuestion;

describe('board AI', () => {
  it('the prompt has the exam question, the model answer and the student question', () => {
    const p = boardAskPrompt(question, '  Xlorofill nima uchun yashil?  ', 'uz');
    expect(p).toContain('Fotosintez nima?');
    expect(p).toContain('quyosh nuridan');
    expect(p).toContain('Xlorofill nima uchun yashil?');
  });

  it('turns the answer into board steps under the question', () => {
    const steps = parseBoardAnswer('```json\n{"lines": ["Birinchi.", " ", 7, "Ikkinchi."], "points": ["Eslab qoling"]}\n```', 'Nega?');
    expect(steps).toEqual([
      { kind: 'title', text: 'Nega?' },
      { kind: 'line', text: 'Birinchi.' },
      { kind: 'line', text: 'Ikkinchi.' },
      { kind: 'point', text: 'Eslab qoling' },
    ]);
  });

  it('keeps the board short and refuses an empty answer', () => {
    const many = JSON.stringify({ lines: Array.from({ length: 20 }, (_, i) => `Gap ${i}.`), points: ['a', 'b', 'c', 'd', 'e'] });
    const steps = parseBoardAnswer(many, 'Savol');
    expect(steps.filter((s) => s.kind === 'line')).toHaveLength(6);
    expect(steps.filter((s) => s.kind === 'point')).toHaveLength(3);
    expect(() => parseBoardAnswer('{"lines": []}', 'Savol')).toThrow();
  });
});
