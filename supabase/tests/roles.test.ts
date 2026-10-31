import { describe, it, expect } from 'vitest';
import { parseAdminIds, resolveRole, newLoginCode, sha256Hex, LOGIN_CODE_RE } from '../functions/_shared/roles';

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

describe('admin login codes', () => {
  it('are 64 hex characters and never repeat', () => {
    const codes = new Set(Array.from({ length: 200 }, newLoginCode));
    expect(codes.size).toBe(200);
    for (const c of codes) expect(LOGIN_CODE_RE.test(c)).toBe(true);
  });
  it('are stored only as a stable SHA-256 hash', async () => {
    const code = newLoginCode();
    const h = await sha256Hex(code);
    expect(h).toHaveLength(64);
    expect(h).not.toBe(code);
    expect(await sha256Hex(code)).toBe(h);
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('rejects malformed codes', () => {
    for (const bad of ['', 'abc', 'g'.repeat(64), 'A'.repeat(64), 'a'.repeat(63), 'a'.repeat(65)]) {
      expect(LOGIN_CODE_RE.test(bad)).toBe(false);
    }
  });
});
