// Verifies the data the "Login with Telegram" widget hands to a website, as described in
// https://core.telegram.org/widgets/login#checking-authorization
// Pure helper (no Deno or npm imports) so it can be unit tested.
//
// Not the same as Mini App initData: here the secret key is SHA-256(bot token).

const enc = new TextEncoder();

export interface WidgetUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

// The widget answers right after the user taps "Confirm", so a short window is enough
// and limits how long a captured payload could be replayed.
export const WIDGET_MAX_AGE_SECONDS = 5 * 60;

const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyLoginWidget(
  data: Record<string, unknown>,
  botToken: string,
  now: number = Date.now()
): Promise<WidgetUser | null> {
  if (!botToken || typeof data?.hash !== 'string') return null;

  // Telegram sends only strings and numbers; anything else means a forged request
  const fields: [string, string][] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === 'hash') continue;
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    fields.push([key, String(value)]);
  }
  const dataCheckString = fields
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secret = await crypto.subtle.digest('SHA-256', enc.encode(botToken));
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = toHex(await crypto.subtle.sign('HMAC', key, enc.encode(dataCheckString)));
  if (!sameText(expected, data.hash.toLowerCase())) return null;

  const authDate = Number(data.auth_date);
  if (!Number.isFinite(authDate) || now / 1000 - authDate > WIDGET_MAX_AGE_SECONDS || authDate > now / 1000 + 60) return null;

  const id = Number(data.id);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return {
    id,
    first_name: typeof data.first_name === 'string' ? data.first_name : undefined,
    last_name: typeof data.last_name === 'string' ? data.last_name : undefined,
    username: typeof data.username === 'string' ? data.username : undefined,
  };
}
