// The board: a model answer shown step by step, the way a teacher writes it up.
// First the question, then the answer sentence by sentence, then the key points to remember. No AI involved.
import { ExamQuestion } from '../types';

export interface BoardStep {
  kind: 'title' | 'line' | 'point';
  text: string;
}

const SENTENCE_END = /(?<=[.!?…])\s+(?=[A-ZА-ЯЁʻ'"«(0-9])/u;

export function boardSteps(question: ExamQuestion): BoardStep[] {
  const answer = question.modelAnswer;
  const steps: BoardStep[] = [{ kind: 'title', text: question.text }];
  if (!answer) return steps;
  for (const line of answer.summary.split(/\n+/)) {
    for (const sentence of line.split(SENTENCE_END)) {
      const text = sentence.trim();
      if (text.length >= 3) steps.push({ kind: 'line', text });
    }
  }
  for (const point of answer.keyPoints) if (point.trim()) steps.push({ kind: 'point', text: point.trim() });
  return steps;
}

// Without a voice the board moves on by itself after time to read the step: about 60 ms a letter, 2.5 to 9 seconds
export const readingTime = (text: string): number => Math.min(9000, Math.max(2500, text.length * 60));
