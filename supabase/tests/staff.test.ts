import { describe, it, expect } from 'vitest';
import { isStaffRole, menuButtonFor } from '../functions/_shared/staff';

describe('isStaffRole', () => {
  it('admins and moderators only', () => {
    expect(isStaffRole('admin')).toBe(true);
    expect(isStaffRole('moderator')).toBe(true);
    for (const no of ['student', '', 'ADMIN', undefined, null]) expect(isStaffRole(no)).toBe(false);
  });
});

describe('menuButtonFor', () => {
  const url = 'https://admin.example.com';

  it('staff get the Admin button that opens the site as a Mini App', () => {
    expect(menuButtonFor('admin', url)).toEqual({ type: 'web_app', text: 'Admin', web_app: { url } });
    expect(menuButtonFor('moderator', ` ${url} `)).toEqual({ type: 'web_app', text: 'Admin', web_app: { url } });
  });

  it('everyone else gets the normal menu back (this also takes the button away from someone who is no longer staff)', () => {
    for (const role of ['student', undefined, null, '']) expect(menuButtonFor(role, url)).toEqual({ type: 'default' });
  });

  it('shows nothing it cannot open: no address, or not https', () => {
    expect(menuButtonFor('admin', undefined)).toBeNull();
    expect(menuButtonFor('admin', '')).toBeNull();
    expect(menuButtonFor('admin', 'http://admin.example.com')).toBeNull();
  });
});
