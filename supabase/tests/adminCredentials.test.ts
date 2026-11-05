import { describe, it, expect } from 'vitest';
import { isOwner } from '../functions/_shared/roles';
import { generatePassword, hashPassword, normalizeLogin, passwordProblem, spendTheSameTime, suggestLogin, validLogin, verifyPassword } from '../functions/_shared/adminCredentials';

describe('logins', () => {
  it('accepts short plain logins and nothing else', () => {
    for (const ok of ['ali', 'javohir.m', 'a-b_c', 'user123']) expect(validLogin(ok)).toBe(true);
    for (const bad of ['', 'ab', 'Ali', '.ali', 'a b', 'ali@x', 'x'.repeat(33), 42, null]) expect(validLogin(bad)).toBe(false);
  });

  it('normalizes what a person types', () => {
    expect(normalizeLogin('  Ali.V ')).toBe('ali.v');
    expect(normalizeLogin(undefined)).toBe('');
  });

  it('suggests the username, then the first name, then "admin"', () => {
    expect(suggestLogin('Sanjaroktamov', 'Sanjar')).toBe('sanjaroktamov');
    expect(suggestLogin(null, 'Sanjar')).toBe('sanjar');
    expect(suggestLogin(null, 'Жавохир 👑')).toBe('admin');
    expect(suggestLogin('_x', 'ab')).toBe('admin');
    expect(validLogin(suggestLogin('A_very_long_username_that_goes_on_and_on', null))).toBe(true);
  });
});

describe('generatePassword', () => {
  it('makes 16 characters without look-alikes', () => {
    for (let i = 0; i < 50; i++) {
      const p = generatePassword();
      expect(p).toHaveLength(16);
      expect(p).toMatch(/^[a-km-zA-HJ-NP-Z2-9]+$/);
    }
  });

  it('is different every time', () => {
    expect(new Set(Array.from({ length: 50 }, () => generatePassword())).size).toBe(50);
  });

  it('does not favour the first letters of the alphabet', () => {
    // bytes in the unfair top slice are skipped, so a source of only those bytes still ends with a fair draw
    let calls = 0;
    const source = (n: number) => (calls++ === 0 ? new Uint8Array(n).fill(255) : new Uint8Array(n).fill(7));
    expect(generatePassword(source)).toBe('h'.repeat(16)); // byte 7 -> index 7 of the alphabet, which is 'h'
  });
});

describe('passwordProblem', () => {
  it('accepts a long enough password that is not obvious', () => {
    expect(passwordProblem('Zebra-Lamp-4821', 'ali')).toBeNull();
    expect(passwordProblem('0123456789ab', 'x')).toBe('common'); // starts like a counting sequence
    expect(passwordProblem('kitob qalam daftar', 'ali')).toBeNull();
  });

  it('refuses short and huge ones', () => {
    expect(passwordProblem('Short1!', 'ali')).toBe('short');
    expect(passwordProblem('a'.repeat(101), 'ali')).toBe('long');
  });

  it('refuses a password that contains the login', () => {
    expect(passwordProblem('Sanjar-2026-ok', 'sanjar')).toBe('contains_login');
    expect(passwordProblem('Zebra-Lamp-4821', 'zebra')).toBe('contains_login');
  });

  it('refuses the usual weak ones', () => {
    for (const weak of ['1234567890', '12345678901', 'aaaaaaaaaaaa', 'abababababab', 'Password', 'administrator']) {
      expect(['short', 'common']).toContain(passwordProblem(weak, 'zz'));
    }
  });
});

describe('hashPassword / verifyPassword', () => {
  it('accepts the right password and rejects others', async () => {
    const record = await hashPassword('correct horse', 1000);
    expect(await verifyPassword('correct horse', record)).toBe(true);
    expect(await verifyPassword('correct horsf', record)).toBe(false);
    expect(await verifyPassword('', record)).toBe(false);
  });

  it('salts every hash, so equal passwords look different', async () => {
    const a = await hashPassword('same', 1000);
    const b = await hashPassword('same', 1000);
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it('keeps working for hashes made with another iteration count', async () => {
    const old = await hashPassword('pw', 500);
    expect(old.iterations).toBe(500);
    expect(await verifyPassword('pw', old)).toBe(true);
  });

  it('does the same work for a login that does not exist', async () => {
    await expect(spendTheSameTime('anything')).resolves.toBeUndefined();
  });
});

describe('isOwner', () => {
  it('is true only for ids in the secret', () => {
    expect(isOwner(7629355296, '7629355296')).toBe(true);
    expect(isOwner(7537966029, '7629355296')).toBe(false);
    expect(isOwner(7629355296, '1, 7629355296')).toBe(true);
  });

  it('is nobody when the secret is missing or empty', () => {
    expect(isOwner(7629355296, undefined)).toBe(false);
    expect(isOwner(7629355296, '')).toBe(false);
  });
});
