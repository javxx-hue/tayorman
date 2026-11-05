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

// Checks if telegramId is listed as admin. If envAdmins is defined, it takes precedence.
// Fallback IDs are only used when envAdmins is undefined or null.
export function isListedAdminUser(telegramId: number, envAdmins?: string | null, fallbackIds: number[] = []): boolean {
  if (envAdmins !== undefined && envAdmins !== null) {
    return parseAdminIds(envAdmins).has(telegramId);
  }
  return fallbackIds.includes(telegramId);
}

// ADMIN_TELEGRAM_IDS is the only source of the 'admin' role. Someone removed from the
// list drops back to student; moderators (set in the admin panel) keep their role.
export function resolveRole(listedAsAdmin: boolean, current?: string | null): Role {
  if (listedAsAdmin) return 'admin';
  if (current === 'moderator') return 'moderator';
  return 'student';
}

// The owner may give other admins a login and password; with no OWNER_TELEGRAM_IDS secret nobody is the owner
export const isOwner = (telegramId: number, secret: string | undefined): boolean => parseAdminIds(secret).has(telegramId);

export interface KnownProfile {
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  role: string;
  last_seen_at: string;
}

// How long "last seen" may lag before it is written again; every message used to write it
export const SEEN_REFRESH_MS = 10 * 60 * 1000;

// What to write for someone we already know, or null when nothing changed and the profile row can be left alone.
// This saves a database round trip on almost every message.
export function profileChanges(
  known: KnownProfile,
  tg: { first_name?: string; last_name?: string; username?: string },
  listedAsAdmin: boolean,
  now: number
): { first_name: string | null; last_name: string | null; username: string | null; role: Role; last_seen_at: string } | null {
  const next = {
    first_name: tg.first_name ?? null,
    last_name: tg.last_name ?? null,
    username: tg.username ?? null,
    role: resolveRole(listedAsAdmin, known.role),
  };
  const same =
    next.first_name === known.first_name && next.last_name === known.last_name && next.username === known.username && next.role === known.role;
  const seen = Date.parse(known.last_seen_at);
  const fresh = Number.isFinite(seen) && now - seen < SEEN_REFRESH_MS;
  if (same && fresh) return null;
  return { ...next, last_seen_at: new Date(now).toISOString() };
}
