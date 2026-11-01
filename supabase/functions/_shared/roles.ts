// Pure helpers (no Deno or npm imports) so they can be unit tested.
export type Role = 'student' | 'moderator' | 'admin';

// "123, 456,abc" -> Set {123, 456}
export function parseAdminIds(raw: string | undefined): Set<number> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0)
  );
}

// ADMIN_TELEGRAM_IDS is the only source of the 'admin' role. Someone removed from the
// list drops back to student; moderators (set in the admin panel) keep their role.
export function resolveRole(listedAsAdmin: boolean, current?: string | null): Role {
  if (listedAsAdmin) return 'admin';
  if (current === 'moderator') return 'moderator';
  return 'student';
}
