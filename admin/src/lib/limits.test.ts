import { describe, it, expect } from 'vitest';
import { MAX_AI_LIMIT, parseLimit } from './limits';

describe('parseLimit', () => {
  it('accepts whole numbers up to the database maximum, zero included', () => {
    expect(parseLimit('0')).toBe(0);
    expect(parseLimit('30')).toBe(30);
    expect(parseLimit(` ${MAX_AI_LIMIT} `)).toBe(MAX_AI_LIMIT);
  });

  it('refuses what the database would refuse', () => {
    expect(parseLimit('1001')).toBeNull(); // four digits, but over the maximum
    expect(parseLimit('9999')).toBeNull();
  });

  it('refuses anything that is not a plain number', () => {
    for (const bad of ['', ' ', '-5', '1.5', '1e3', 'abc', '12345']) expect(parseLimit(bad)).toBeNull();
  });
});
