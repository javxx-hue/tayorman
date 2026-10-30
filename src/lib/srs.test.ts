import { describe, it, expect } from 'vitest';
import { dueQueue, formatInterval, isDue, isMastered, isNew, nextDueDate, previewIntervals, reviewCard, shouldRequeue } from './srs';
import { Flashcard } from '../types';

const card = (id: string): Flashcard => ({ id, front: `Q${id}`, back: `A${id}` });
const MIN = 60_000;
const DAY = 86_400_000;

describe('reviewCard', () => {
  it('schedules a new card answered "again" within minutes and keeps it in the session', () => {
    const now = new Date('2026-11-01T10:00:00Z');
    const reviewed = reviewCard(card('1'), 'again', now);
    expect(isNew(reviewed)).toBe(false);
    expect(reviewed.rating).toBe('again');
    expect(new Date(reviewed.srs!.due).getTime() - now.getTime()).toBeLessThan(15 * MIN);
    expect(shouldRequeue(reviewed, now)).toBe(true);
  });

  it('schedules "easy" on a new card days ahead and drops it from the session', () => {
    const now = new Date('2026-11-01T10:00:00Z');
    const reviewed = reviewCard(card('1'), 'easy', now);
    expect(new Date(reviewed.srs!.due).getTime() - now.getTime()).toBeGreaterThan(DAY);
    expect(shouldRequeue(reviewed, now)).toBe(false);
    expect(isMastered(reviewed)).toBe(true);
  });

  it('grows the interval with consecutive "good" answers', () => {
    let c = card('1');
    let now = new Date('2026-11-01T10:00:00Z');
    const gaps: number[] = [];
    for (let i = 0; i < 5; i++) {
      c = reviewCard(c, 'good', now);
      const due = new Date(c.srs!.due);
      gaps.push(due.getTime() - now.getTime());
      now = due;
    }
    expect(gaps[4]).toBeGreaterThan(gaps[2]);
    expect(isMastered(c)).toBe(true);
  });

  it('does not mutate the original card', () => {
    const original = card('1');
    reviewCard(original, 'good');
    expect(original.srs).toBeUndefined();
  });
});

describe('dueQueue', () => {
  it('puts overdue reviews first (oldest first), then new cards, and skips future cards', () => {
    const now = new Date('2026-11-10T10:00:00Z');
    const old = reviewCard(card('old'), 'easy', new Date('2026-10-01T10:00:00Z'));
    const recent = reviewCard(card('recent'), 'easy', new Date('2026-10-20T10:00:00Z'));
    const future = reviewCard(card('future'), 'easy', now);
    const fresh = card('fresh');

    expect(isDue(future, now)).toBe(false);
    expect(dueQueue([fresh, future, recent, old], now).map((c) => c.id)).toEqual(['old', 'recent', 'fresh']);
  });

  it('reports the earliest upcoming review', () => {
    const now = new Date('2026-11-01T10:00:00Z');
    const a = reviewCard(card('a'), 'again', now);
    const b = reviewCard(card('b'), 'easy', now);
    expect(nextDueDate([a, b, card('new')])!.getTime()).toBe(new Date(a.srs!.due).getTime());
    expect(nextDueDate([card('new')])).toBeNull();
  });
});

describe('previewIntervals', () => {
  it('orders again < hard < good < easy for a new card', () => {
    const p = previewIntervals(card('1'), new Date('2026-11-01T10:00:00Z'));
    expect(p.again).toBeLessThan(p.hard);
    expect(p.hard).toBeLessThan(p.good);
    expect(p.good).toBeLessThan(p.easy);
  });
});

describe('formatInterval', () => {
  it('formats minutes, hours, days and months in Uzbek', () => {
    expect(formatInterval(30_000, 'uz')).toBe('<1 daq');
    expect(formatInterval(10 * MIN, 'uz')).toBe('10 daq');
    expect(formatInterval(3 * 60 * MIN, 'uz')).toBe('3 soat');
    expect(formatInterval(4 * DAY, 'uz')).toBe('4 kun');
    expect(formatInterval(60 * DAY, 'uz')).toBe('2 oy');
  });
});
