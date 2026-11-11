import { describe, it, expect } from 'vitest';
import { boardSteps, readingTime } from './board';
import type { ExamQuestion } from '../types';

const q = (summary?: string, keyPoints: string[] = []): ExamQuestion => ({
  id: 'q1',
  text: 'TCP va UDP farqi?',
  attempts: [],
  ...(summary !== undefined ? { modelAnswer: { summary, keyPoints, sources: [] } } : {}),
});

describe('boardSteps', () => {
  it('question, then the answer sentence by sentence, then the key points', () => {
    const steps = boardSteps(q('TCP ishonchli. UDP esa tezroq! 3 bosqichli qo\'l siqish bor.', ['TCP ishonchli', 'UDP tez']));
    expect(steps).toEqual([
      { kind: 'title', text: 'TCP va UDP farqi?' },
      { kind: 'line', text: 'TCP ishonchli.' },
      { kind: 'line', text: 'UDP esa tezroq!' },
      { kind: 'line', text: "3 bosqichli qo'l siqish bor." },
      { kind: 'point', text: 'TCP ishonchli' },
      { kind: 'point', text: 'UDP tez' },
    ]);
  });

  it('does not split inside numbers like 0.1 or 802.11', () => {
    const steps = boardSteps(q('Kechikish 0.1 ms gacha. Standart 802.11 deb ataladi.'));
    expect(steps.map((s) => s.text)).toEqual(['TCP va UDP farqi?', 'Kechikish 0.1 ms gacha.', 'Standart 802.11 deb ataladi.']);
  });

  it('only the question when there is no model answer', () => {
    expect(boardSteps(q())).toEqual([{ kind: 'title', text: 'TCP va UDP farqi?' }]);
  });
});

describe('readingTime', () => {
  it('stays between 2.5 and 9 seconds', () => {
    expect(readingTime('ab')).toBe(2500);
    expect(readingTime('x'.repeat(100))).toBe(6000);
    expect(readingTime('x'.repeat(1000))).toBe(9000);
  });
});
