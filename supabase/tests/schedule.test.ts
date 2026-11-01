import { describe, it, expect } from 'vitest';
import { MAX_SCHEDULE_DAYS, parseSchedule } from '../functions/_shared/schedule';

const NOW = Date.UTC(2026, 10, 1, 12, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();

describe('parseSchedule', () => {
  it('no time means send now', () => {
    for (const raw of [undefined, null, '']) expect(parseSchedule(raw, NOW)).toEqual({ ok: true, at: null });
  });

  it('accepts a future moment', () => {
    const r = parseSchedule(iso(NOW + 3_600_000), NOW);
    expect(r).toMatchObject({ ok: true });
    expect(r.ok && r.at?.getTime()).toBe(NOW + 3_600_000);
  });

  it('allows a few seconds of clock drift but not the past', () => {
    expect(parseSchedule(iso(NOW - 30_000), NOW).ok).toBe(true);
    expect(parseSchedule(iso(NOW - 10 * 60_000), NOW).ok).toBe(false);
  });

  it('refuses more than 90 days ahead, garbage and wrong types', () => {
    expect(parseSchedule(iso(NOW + MAX_SCHEDULE_DAYS * 86_400_000), NOW).ok).toBe(true);
    expect(parseSchedule(iso(NOW + (MAX_SCHEDULE_DAYS + 1) * 86_400_000), NOW).ok).toBe(false);
    expect(parseSchedule('tomorrow-ish', NOW).ok).toBe(false);
    expect(parseSchedule(12345, NOW).ok).toBe(false);
    expect(parseSchedule({}, NOW).ok).toBe(false);
  });
});
