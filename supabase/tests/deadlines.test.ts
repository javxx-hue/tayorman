import { describe, it, expect } from 'vitest';
import { deadlineLines, dueWhen, isForStudent, type DueAssignment } from '../functions/_shared/deadlines';

// 10:00 UTC = 15:00 in Tashkent, 1 Nov 2026
const NOW = Date.UTC(2026, 10, 1, 10, 0, 0);
const at = (iso: string, over: Partial<DueAssignment> = {}): DueAssignment => ({ id: iso, title: `T ${iso.slice(5, 16)}`, dueAt: iso, audienceAll: true, communityIds: [], ...over });

describe('dueWhen (Tashkent days)', () => {
  it('tells today and tomorrow', () => {
    expect(dueWhen('2026-11-01T13:00:00Z', NOW)).toBe('today'); // 18:00 Tashkent
    expect(dueWhen('2026-11-02T04:00:00Z', NOW)).toBe('tomorrow'); // 09:00 Tashkent
  });

  it('counts the day in Tashkent, not in UTC', () => {
    // 20:30 UTC on the 1st is already 01:30 on the 2nd in Tashkent
    expect(dueWhen('2026-11-01T20:30:00Z', NOW)).toBe('tomorrow');
  });

  it('ignores the past and anything further than tomorrow', () => {
    expect(dueWhen('2026-11-01T09:00:00Z', NOW)).toBeNull();
    expect(dueWhen('2026-11-03T10:00:00Z', NOW)).toBeNull();
    expect(dueWhen('nonsense', NOW)).toBeNull();
  });
});

describe('isForStudent', () => {
  it('everyone, or one of the student\'s groups', () => {
    expect(isForStudent({ audienceAll: true, communityIds: [] }, new Set())).toBe(true);
    expect(isForStudent({ audienceAll: false, communityIds: ['g1', 'g2'] }, new Set(['g2']))).toBe(true);
    expect(isForStudent({ audienceAll: false, communityIds: ['g1'] }, new Set(['g9']))).toBe(false);
    expect(isForStudent({ audienceAll: false, communityIds: ['g1'] }, new Set())).toBe(false);
  });
});

describe('deadlineLines', () => {
  it('lists soonest first with day and time, in the student language', () => {
    const items = [at('2026-11-02T04:00:00Z', { title: 'Keyingi' }), at('2026-11-01T13:00:00Z', { title: 'Birinchi' })];
    expect(deadlineLines('uz', items, NOW)).toEqual(['• Birinchi: bugun 18:00 gacha', '• Keyingi: ertaga 09:00 gacha']);
    expect(deadlineLines('ru', items, NOW)).toEqual(['• Birinchi: сегодня до 18:00', '• Keyingi: завтра до 09:00']);
  });

  it('skips what is past or too far', () => {
    expect(deadlineLines('uz', [at('2026-11-01T09:00:00Z'), at('2026-11-09T09:00:00Z')], NOW)).toEqual([]);
  });
});
