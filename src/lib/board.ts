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

// Splits a line into plain text and key terms, so the board can underline the terms in yellow chalk
export interface Piece {
  text: string;
  key: boolean;
}

export function highlight(text: string, terms: string[]): Piece[] {
  const wanted = terms.map((t) => t.trim()).filter((t) => t.length >= 2);
  if (!wanted.length) return [{ text, key: false }];
  const escaped = wanted.sort((a, b) => b.length - a.length).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${escaped.join('|')})(?![\\p{L}\\p{N}])`, 'giu');
  const pieces: Piece[] = [];
  let at = 0;
  for (const m of text.matchAll(pattern)) {
    const start = m.index ?? 0;
    if (start > at) pieces.push({ text: text.slice(at, start), key: false });
    pieces.push({ text: m[0], key: true });
    at = start + m[0].length;
  }
  if (at < text.length) pieces.push({ text: text.slice(at), key: false });
  return pieces;
}

// How fast the board writes and speaks
export type BoardSpeed = 'slow' | 'normal' | 'fast';
export const SPEEDS: Record<BoardSpeed, { lettersPerSecond: number; speechRate: number; wait: number }> = {
  slow: { lettersPerSecond: 16, speechRate: 0.8, wait: 1.4 },
  normal: { lettersPerSecond: 28, speechRate: 0.95, wait: 1 },
  fast: { lettersPerSecond: 45, speechRate: 1.15, wait: 0.7 },
};

const SPEED_KEY = 'sessiyagatayyorlan_board_speed';
export function getBoardSpeed(): BoardSpeed {
  try {
    const v = localStorage.getItem(SPEED_KEY);
    return v === 'slow' || v === 'fast' ? v : 'normal';
  } catch {
    return 'normal';
  }
}
export function setBoardSpeed(speed: BoardSpeed): void {
  try {
    localStorage.setItem(SPEED_KEY, speed);
  } catch {
    /* blocked storage: the default speed applies */
  }
}
