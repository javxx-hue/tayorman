import { describe, it, expect } from 'vitest';
import { nextInQueue, placeInQueue, queueOf, usableQueue } from './practiceQueue';

describe('practice queue', () => {
  const queue = ['a', 'b', 'c', 'd'];

  it('goes forward one by one and never back to the start', () => {
    // the old behaviour bounced between the first two questions: take the first one that is not the current
    expect(nextInQueue(queue, 'a')).toBe('b');
    expect(nextInQueue(queue, 'b')).toBe('c');
    expect(nextInQueue(queue, 'c')).toBe('d');
  });

  it('ends at the last question', () => {
    expect(nextInQueue(queue, 'd')).toBeNull();
  });

  it('has no next for a question that is not in it', () => {
    expect(nextInQueue(queue, 'zzz')).toBeNull();
    expect(nextInQueue([], 'a')).toBeNull();
  });

  it('tells the place, 1-based', () => {
    expect(placeInQueue(queue, 'a')).toBe(1);
    expect(placeInQueue(queue, 'd')).toBe(4);
    expect(placeInQueue(queue, 'zzz')).toBe(0);
  });

  it('drops questions that no longer exist', () => {
    expect(usableQueue(queue, new Set(['a', 'c']))).toEqual(['a', 'c']);
  });

  it('reads the queue from the page state and refuses anything else', () => {
    expect(queueOf({ queue: ['a', 'b'] })).toEqual(['a', 'b']);
    for (const bad of [null, undefined, {}, { queue: 'a' }, { queue: [1, 2] }, 'x']) expect(queueOf(bad)).toBeNull();
  });
});
