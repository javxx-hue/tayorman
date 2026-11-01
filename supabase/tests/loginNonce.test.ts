import { describe, it, expect } from 'vitest';
import { APPROVAL_MAX_AGE_MS, isFresh, nonceCode, nonceFromStart, nonceHash, NONCE_RE } from '../functions/_shared/loginNonce';

const NONCE = 'a3f91c0d5b7e4a2f8c6d1e9b0a7f3c25';

describe('admin sign-in nonce', () => {
  it('reads the nonce from the /start argument and rejects anything else', () => {
    expect(nonceFromStart(`a_${NONCE}`)).toBe(NONCE);
    expect(nonceFromStart(NONCE)).toBeNull(); // no prefix
    expect(nonceFromStart(`c_${NONCE}`)).toBeNull(); // a group invite, not a sign-in
    expect(nonceFromStart(`a_${NONCE.slice(1)}`)).toBeNull(); // too short
    expect(nonceFromStart(`a_${NONCE}0`)).toBeNull(); // too long
    expect(nonceFromStart(`a_${NONCE.toUpperCase()}`)).toBeNull(); // only lower-case hex is ever issued
    expect(nonceFromStart(undefined)).toBeNull();
    expect(NONCE_RE.test(NONCE)).toBe(true);
  });

  it('shows the same four characters on the site and in the bot', () => {
    expect(nonceCode(NONCE)).toBe('A3F9');
  });

  it('stores only a SHA-256 of the nonce, never the nonce itself', async () => {
    const hash = await nonceHash(NONCE);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(NONCE);
    expect(await nonceHash(NONCE)).toBe(hash);
    expect(await nonceHash(`${NONCE.slice(0, -1)}6`)).not.toBe(hash);
  });

  it('accepts a confirmation for 5 minutes and no longer', () => {
    const now = Date.UTC(2026, 9, 31, 12, 0, 0);
    expect(isFresh(new Date(now - 1000), now)).toBe(true);
    expect(isFresh(new Date(now - APPROVAL_MAX_AGE_MS), now)).toBe(true);
    expect(isFresh(new Date(now - APPROVAL_MAX_AGE_MS - 1), now)).toBe(false);
    expect(isFresh(new Date(now + 60_000), now)).toBe(false); // from the future
  });
});
