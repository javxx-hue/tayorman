// Daily AI limits are whole numbers from 0 to 1000 (the same range the database accepts).
export const MAX_AI_LIMIT = 1000;

export function parseLimit(draft: string): number | null {
  if (!/^\d{1,4}$/.test(draft.trim())) return null;
  const n = Number(draft);
  return n <= MAX_AI_LIMIT ? n : null;
}
