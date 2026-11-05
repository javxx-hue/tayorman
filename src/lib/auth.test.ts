import { describe, it, expect } from 'vitest';
import { checkIsTelegram } from './telegram';

describe('Telegram WebApp Environment Detection', () => {
  it('returns false when window.Telegram is undefined (regular browser)', () => {
    // In node/vitest environment, window.Telegram is undefined by default
    expect(checkIsTelegram()).toBe(false);
  });
});
