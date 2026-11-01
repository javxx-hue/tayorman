import { describe, it, expect } from 'vitest';
import { checkIsTelegram } from './telegram';

describe('Admin Roles & Authorization', () => {
  const ADMIN_IDS = [7537966029, 7629355296];

  it('correctly identifies Sanjar and Javohir as admins', () => {
    expect(ADMIN_IDS.includes(7537966029)).toBe(true);
    expect(ADMIN_IDS.includes(7629355296)).toBe(true);
  });

  it('does not grant admin role to regular student IDs', () => {
    expect(ADMIN_IDS.includes(123456789)).toBe(false);
    expect(ADMIN_IDS.includes(0)).toBe(false);
  });
});

describe('Telegram WebApp Environment Detection', () => {
  it('returns false when window.Telegram is undefined (regular browser)', () => {
    // In node/vitest environment, window.Telegram is undefined by default
    expect(checkIsTelegram()).toBe(false);
  });
});
