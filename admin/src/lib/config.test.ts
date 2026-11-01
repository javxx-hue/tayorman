import { describe, it, expect } from 'vitest';
import { inviteLink } from './config';

describe('group invite link', () => {
  it('opens the bot with the code the bot understands (c_ + 12 hex)', () => {
    const link = inviteLink('tayormanbot', 'a1b2c3d4e5f6');
    expect(link).toBe('https://t.me/tayormanbot?start=c_a1b2c3d4e5f6');
    // the same shape the bot accepts for /start
    expect(link.split('start=')[1]).toMatch(/^c_[a-f0-9]{12}$/);
  });
});
