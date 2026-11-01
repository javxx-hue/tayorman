// Admin site sign-in through the bot. The site makes a random nonce and opens
//   https://t.me/<bot>?start=a_<nonce>
// The bot shows the admin a short code, and when they confirm it stores the SHA-256 of the
// nonce. The site keeps asking with the nonce until the confirmation is there.
// Pure helpers (no Deno or npm imports) so they can be unit tested.

export const NONCE_RE = /^[a-f0-9]{32}$/;
export const START_PREFIX = 'a_';

// A confirmation is valid only briefly: nobody should be able to use a stale one
export const APPROVAL_MAX_AGE_MS = 5 * 60 * 1000;

export async function nonceHash(nonce: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Four characters shown both on the site and in the bot, so the admin can see
// that the confirmation belongs to the page they just opened
export const nonceCode = (nonce: string) => nonce.slice(0, 4).toUpperCase();

// "a_<32 hex>" from the /start argument, or null
export function nonceFromStart(arg: string | undefined): string | null {
  if (!arg?.startsWith(START_PREFIX)) return null;
  const nonce = arg.slice(START_PREFIX.length);
  return NONCE_RE.test(nonce) ? nonce : null;
}

export const isFresh = (approvedAt: string | Date, now = Date.now()) => {
  const age = now - new Date(approvedAt).getTime();
  return age >= 0 && age <= APPROVAL_MAX_AGE_MS;
};
