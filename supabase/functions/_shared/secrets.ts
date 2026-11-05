// Comparing a secret sent by a caller with the one we hold. Pure code so it can be unit tested.
const enc = new TextEncoder();

// The time taken does not depend on where the two differ. A missing or empty secret on our side never matches
// (otherwise an unset secret and a missing header would "agree").
export function sameSecret(given: string | null | undefined, expected: string | undefined): boolean {
  if (!expected || given === null || given === undefined) return false;
  const a = enc.encode(given);
  const b = enc.encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
