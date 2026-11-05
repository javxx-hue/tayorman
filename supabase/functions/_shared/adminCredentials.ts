// Login + password for admins who already exist (admin or moderator). A second door to the admin site,
// next to Telegram. Only the owner can issue them. Pure code (WebCrypto only) so it can be unit tested.

// Wrong passwords are counted in the database (admin_login_failed, migration 0007): 5 in a row pause the login for 15 minutes.
const ITERATIONS = 210_000; // PBKDF2-SHA256, the current OWASP recommendation

export const LOGIN_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;
export const validLogin = (login: unknown): login is string => typeof login === 'string' && LOGIN_RE.test(login);
export const normalizeLogin = (raw: unknown): string => (typeof raw === 'string' ? raw.trim().toLowerCase() : '');

// No look-alike characters (0/O, 1/l/I), because the password is read off a screen and typed
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PASSWORD_LENGTH = 16; // about 93 bits

export type PasswordProblem = 'short' | 'long' | 'contains_login' | 'common';
export const MIN_PASSWORD = 10;
const COMMON = ['password', 'parol', 'qwerty', 'qwertyuiop', 'admin', 'administrator', 'letmein', 'welcome', 'iloveyou', 'tayyorman', 'sessiya'];

// A password the owner types must be at least a decent one; null means it is fine. Brute force is limited anyway
// (5 wrong tries pause the login), but nobody should be able to sign in with "1234567890".
export function passwordProblem(password: string, login: string): PasswordProblem | null {
  if (password.length < MIN_PASSWORD) return 'short';
  if (password.length > 100) return 'long';
  const lower = password.toLowerCase();
  if (login.length >= 3 && lower.includes(login.toLowerCase())) return 'contains_login';
  const stripped = lower.replace(/[^a-z]/g, '');
  if (new Set(password).size < 4 || /^(?:0123456789|1234567890|123456789|12345678)/.test(password) || COMMON.some((c) => stripped === c || lower === c)) return 'common';
  return null;
}

// Without a typed password the server makes one at random
export function generatePassword(randomBytes: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const limit = 256 - (256 % ALPHABET.length); // bytes above this would favour the first letters
  let out = '';
  while (out.length < PASSWORD_LENGTH) {
    for (const b of randomBytes(PASSWORD_LENGTH * 2)) {
      if (b < limit && out.length < PASSWORD_LENGTH) out += ALPHABET[b % ALPHABET.length];
    }
  }
  return out;
}

// A login to offer: the Telegram username, else the first name in Latin letters, else "admin"
export function suggestLogin(username?: string | null, firstName?: string | null): string {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9._-]/g, '').replace(/^[^a-z0-9]+/, '').slice(0, 24);
  for (const candidate of [username ?? '', firstName ?? '']) {
    const login = clean(candidate);
    if (login.length >= 3) return login;
  }
  return 'admin';
}

export interface PasswordRecord {
  salt: string; // base64
  hash: string; // base64
  iterations: number;
}

const enc = new TextEncoder();
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string, iterations = ITERATIONS): Promise<PasswordRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: b64(salt), hash: b64(await derive(password, salt, iterations)), iterations };
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyPassword(password: string, record: PasswordRecord): Promise<boolean> {
  return sameBytes(await derive(password, unb64(record.salt), record.iterations), unb64(record.hash));
}

// For a login that does not exist: the same amount of work, so the answer time does not reveal it
export async function spendTheSameTime(password: string): Promise<void> {
  await derive(password, new Uint8Array(16), ITERATIONS);
}
