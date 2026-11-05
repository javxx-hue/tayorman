// Who counts as staff, and what the bot's menu button shows them. Pure (no Deno or npm imports) so it can be unit tested.

export const STAFF_ROLES = ['admin', 'moderator'] as const;

export const isStaffRole = (role: string | null | undefined): boolean => STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number]);

export type MenuButton = { type: 'web_app'; text: string; web_app: { url: string } } | { type: 'default' };

// Staff get an "Admin" button next to the message box that opens the admin site inside Telegram.
// Everyone else keeps the bot's normal menu button. No admin address configured: nothing to show (null).
export function menuButtonFor(role: string | null | undefined, adminUrl: string | undefined): MenuButton | null {
  if (!isStaffRole(role)) return { type: 'default' };
  const url = adminUrl?.trim();
  if (!url || !/^https:\/\//i.test(url)) return null; // Telegram only opens https
  return { type: 'web_app', text: 'Admin', web_app: { url } };
}
