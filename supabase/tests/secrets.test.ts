import { describe, it, expect } from 'vitest';
import { sameSecret } from '../functions/_shared/secrets';

describe('sameSecret', () => {
  it('accepts only the exact secret', () => {
    expect(sameSecret('s3cret-value', 's3cret-value')).toBe(true);
    expect(sameSecret('s3cret-valuf', 's3cret-value')).toBe(false);
    expect(sameSecret('s3cret', 's3cret-value')).toBe(false); // a prefix is not enough
    expect(sameSecret('s3cret-value-and-more', 's3cret-value')).toBe(false);
    expect(sameSecret('S3CRET-VALUE', 's3cret-value')).toBe(false);
  });

  it('never matches when we hold no secret, even against an empty or missing header', () => {
    expect(sameSecret('', undefined)).toBe(false);
    expect(sameSecret(null, undefined)).toBe(false);
    expect(sameSecret('', '')).toBe(false);
    expect(sameSecret(undefined, '')).toBe(false);
  });

  it('refuses a missing header', () => {
    expect(sameSecret(null, 'x')).toBe(false);
    expect(sameSecret(undefined, 'x')).toBe(false);
  });

  it('copes with non-ASCII text', () => {
    expect(sameSecret('parol-юз', 'parol-юз')).toBe(true);
    expect(sameSecret('parol-юс', 'parol-юз')).toBe(false);
  });
});
