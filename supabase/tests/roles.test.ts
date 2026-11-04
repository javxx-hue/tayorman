import { describe, it, expect } from 'vitest';
import { isListedAdminUser, parseAdminIds, profileChanges, resolveRole } from '../functions/_shared/roles';

describe('parseAdminIds', () => {
  it('reads a comma separated list and ignores junk', () => {
    expect([...parseAdminIds('100200300, 42 ,abc,,-5,1.5,0')]).toEqual([100200300, 42]);
    expect(parseAdminIds(undefined).size).toBe(0);
    expect(parseAdminIds('').size).toBe(0);
  });
});

describe('isListedAdminUser', () => {
  it('prefers the envAdmins list when defined', () => {
    expect(isListedAdminUser(111, '111,222', [333])).toBe(true);
    expect(isListedAdminUser(333, '111,222', [333])).toBe(false);
  });

  it('falls back to fallbackIds when envAdmins is undefined or null', () => {
    expect(isListedAdminUser(333, undefined, [333])).toBe(true);
    expect(isListedAdminUser(333, null, [333])).toBe(true);
    expect(isListedAdminUser(444, undefined, [333])).toBe(false);
  });
});

describe('resolveRole', () => {
  it('makes listed IDs admin, whatever they were before', () => {
    expect(resolveRole(true, null)).toBe('admin');
    expect(resolveRole(true, 'student')).toBe('admin');
    expect(resolveRole(true, 'moderator')).toBe('admin');
  });
  it('demotes an admin who was removed from the list', () => {
    expect(resolveRole(false, 'admin')).toBe('student');
  });
  it('keeps moderators and students as they are', () => {
    expect(resolveRole(false, 'moderator')).toBe('moderator');
    expect(resolveRole(false, 'student')).toBe('student');
    expect(resolveRole(false, null)).toBe('student');
    expect(resolveRole(false, 'something-else')).toBe('student');
  });
});

describe('profileChanges', () => {
  const now = Date.parse('2026-01-01T12:00:00Z');
  const known = { first_name: 'Ali', last_name: null, username: 'ali', role: 'student', last_seen_at: '2026-01-01T11:55:00Z' };
  const tg = { first_name: 'Ali', username: 'ali' };

  it('writes nothing when nothing changed and the visit is recent', () => {
    expect(profileChanges(known, tg, false, now)).toBeNull();
  });

  it('refreshes last seen once it is older than ten minutes', () => {
    const out = profileChanges({ ...known, last_seen_at: '2026-01-01T11:40:00Z' }, tg, false, now);
    expect(out?.last_seen_at).toBe('2026-01-01T12:00:00.000Z');
  });

  it('writes when the name or username changed', () => {
    expect(profileChanges(known, { first_name: 'Ali', username: 'ali2' }, false, now)?.username).toBe('ali2');
    expect(profileChanges(known, { first_name: 'Vali', username: 'ali' }, false, now)?.first_name).toBe('Vali');
  });

  it('writes at once when the role has to change', () => {
    expect(profileChanges(known, tg, true, now)?.role).toBe('admin');
    expect(profileChanges({ ...known, role: 'admin' }, tg, false, now)?.role).toBe('student');
    expect(profileChanges({ ...known, role: 'moderator' }, tg, false, now)).toBeNull();
  });

  it('treats an unreadable date as stale', () => {
    expect(profileChanges({ ...known, last_seen_at: 'nonsense' }, tg, false, now)).not.toBeNull();
  });
});
