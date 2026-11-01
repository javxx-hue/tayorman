import { describe, it, expect } from 'vitest';
import { isExpired, MAX_SESSION_MS } from './auth';

describe('admin session lifetime', () => {
  const now = 1_000_000_000_000;
  it('lasts exactly 8 hours from the moment the link was used', () => {
    expect(MAX_SESSION_MS).toBe(8 * 3600 * 1000);
    expect(isExpired(now - 60_000, now)).toBe(false);
    expect(isExpired(now - MAX_SESSION_MS, now)).toBe(false);
    expect(isExpired(now - MAX_SESSION_MS - 1, now)).toBe(true);
  });
  it('treats a missing login time as expired', () => {
    expect(isExpired(null, now)).toBe(true);
  });
});
