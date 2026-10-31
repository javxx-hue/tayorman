import { describe, it, expect } from 'vitest';
import { parseAdminIds, resolveRole } from '../functions/_shared/roles';

describe('parseAdminIds', () => {
  it('reads a comma separated list and ignores junk', () => {
    expect([...parseAdminIds('100200300, 42 ,abc,,-5,1.5,0')]).toEqual([100200300, 42]);
    expect(parseAdminIds(undefined).size).toBe(0);
    expect(parseAdminIds('').size).toBe(0);
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
