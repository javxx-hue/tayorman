// Verifies Telegram Mini App initData as described in
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
import type { TelegramUser } from './types.ts';

const enc = new TextEncoder();
const MAX_AGE_SECONDS = 24 * 60 * 60;

async function hmac(key: ArrayBuffer | Uint8Array, msg: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, enc.encode(msg));
}

const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface VerifiedInit {
  user: TelegramUser;
  startParam?: string;
}

export async function verifyInitData(initData: string, botToken: string): Promise<VerifiedInit | null> {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = await hmac(enc.encode('WebAppData'), botToken);
  const expected = toHex(await hmac(secretKey, dataCheckString));
  if (!timingSafeEqual(expected, hash)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) return null;

  const userJson = params.get('user');
  if (!userJson) return null;
  const user = JSON.parse(userJson) as TelegramUser;
  if (!user?.id) return null;

  return { user, startParam: params.get('start_param') ?? undefined };
}
