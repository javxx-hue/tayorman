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

// One-time admin login codes: 32 random bytes as hex, stored only as a SHA-256 hash.
export const LOGIN_CODE_RE = /^[a-f0-9]{64}$/;
export const LOGIN_CODE_TTL_MS = 5 * 60 * 1000;

export function newLoginCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
