import { describe, it, expect } from 'vitest';
import { localDateKey, nextStreak } from './storage';

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
