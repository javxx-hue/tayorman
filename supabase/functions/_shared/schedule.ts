// When a broadcast may be scheduled for. Pure (no Deno or npm imports) so it can be unit tested.

export const MAX_SCHEDULE_DAYS = 90;

export type Schedule = { ok: true; at: Date | null } | { ok: false };

// Nothing given = send now (at: null). Otherwise a real moment that is not in the past and not absurdly far ahead.
export function parseSchedule(raw: unknown, now = Date.now()): Schedule {
  if (raw === undefined || raw === null || raw === '') return { ok: true, at: null };
  if (typeof raw !== 'string') return { ok: false };
  const at = new Date(raw);
  const ms = at.getTime();
  if (Number.isNaN(ms) || ms < now - 60_000 || ms > now + MAX_SCHEDULE_DAYS * 86_400_000) return { ok: false };
  return { ok: true, at };
}
