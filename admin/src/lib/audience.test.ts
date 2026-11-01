import { describe, it, expect } from 'vitest';
import { covers, expand, tashkentClock, tashkentToIso } from './audience';

describe('assignment audience vs library audience', () => {
  it('an item for everyone covers anything', () => {
    expect(covers({ all: true, groups: [] }, { all: false, groups: ['g1'] })).toBe(true);
    expect(covers({ all: true, groups: [] }, { all: true, groups: [] })).toBe(true);
  });

  it('a group item covers only the groups it lists, never "everyone"', () => {
    const item = { all: false, groups: ['g1', 'g2'] };
    expect(covers(item, { all: false, groups: ['g1'] })).toBe(true);
    expect(covers(item, { all: false, groups: ['g1', 'g3'] })).toBe(false);
    expect(covers(item, { all: true, groups: [] })).toBe(false);
  });

  it('widens the item audience without dropping what it already had', () => {
    expect(expand({ all: false, groups: ['g1'] }, { all: false, groups: ['g1', 'g2'] })).toEqual({ all: false, groups: ['g1', 'g2'] });
    expect(expand({ all: false, groups: ['g1'] }, { all: true, groups: [] })).toEqual({ all: true, groups: [] });
    expect(expand({ all: true, groups: [] }, { all: false, groups: ['g2'] })).toEqual({ all: true, groups: [] });
  });
});

describe('Tashkent clock', () => {
  it('shows the time in Tashkent, whatever zone the computer is set to', () => {
    expect(tashkentClock(Date.UTC(2026, 10, 1, 10, 37))).toBe('15:37');
    expect(tashkentClock(Date.UTC(2026, 10, 1, 19, 5))).toBe('00:05'); // after midnight
  });
});

describe('deadline typed in the form', () => {
  it('is read as Tashkent time (UTC+5)', () => {
    expect(tashkentToIso('2026-11-05T18:30')).toBe('2026-11-05T13:30:00.000Z');
    expect(tashkentToIso('2026-11-05T02:00')).toBe('2026-11-04T21:00:00.000Z');
  });
  it('rejects anything else', () => {
    expect(tashkentToIso('')).toBeNull();
    expect(tashkentToIso('2026-11-05')).toBeNull();
    expect(tashkentToIso('2026-13-45T10:00')).toBeNull();
  });
});
