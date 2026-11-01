import { describe, it, expect } from 'vitest';
import { checkDue, emptyAssign } from './assignmentActions';

// 10:00 UTC = 15:00 in Tashkent
const NOW = Date.UTC(2026, 10, 1, 10, 0, 0);

describe('checkDue', () => {
  it('no deadline is fine', () => {
    expect(checkDue('', NOW)).toEqual({ ok: true, iso: null });
  });

  it('a future Tashkent time becomes the right moment', () => {
    expect(checkDue('2026-11-05T18:30', NOW)).toEqual({ ok: true, iso: '2026-11-05T13:30:00.000Z' });
  });

  it('refuses the past and says what time it is in Tashkent', () => {
    const r = checkDue('2026-11-01T13:40', NOW); // 13:40 Tashkent is before 15:00 Tashkent
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain('15:00');
  });

  it('refuses garbage', () => {
    expect(checkDue('soon', NOW)).toEqual({ ok: false, error: "Muddat noto'g'ri." });
  });
});

describe('emptyAssign', () => {
  it('starts switched off, with the bot message on', () => {
    expect(emptyAssign).toEqual({ on: false, note: '', due: '', notify: true });
  });
});
