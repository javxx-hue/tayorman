import { describe, it, expect } from 'vitest';
import { createHash, createHmac } from 'node:crypto';
import { verifyLoginWidget, WIDGET_MAX_AGE_SECONDS } from '../functions/_shared/widgetAuth';

const TOKEN = '123456:TEST-bot-token';
const NOW = 1_800_000_000_000; // ms

// Signs the way Telegram does: key = SHA-256(bot token), HMAC over sorted "k=v" lines
function widgetData(fields: Record<string, string | number>, token = TOKEN) {
  const check = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const key = createHash('sha256').update(token).digest();
  return { ...fields, hash: createHmac('sha256', key).update(check).digest('hex') };
}
const fresh = (extra: Record<string, string | number> = {}) => ({ id: 42, first_name: 'Ali', username: 'ali', auth_date: Math.floor(NOW / 1000) - 10, ...extra });

describe('verifyLoginWidget', () => {
  it('accepts correctly signed data and returns the user', async () => {
    expect(await verifyLoginWidget(widgetData(fresh()), TOKEN, NOW)).toEqual({ id: 42, first_name: 'Ali', last_name: undefined, username: 'ali' });
  });

  it('rejects data signed with another bot token', async () => {
    expect(await verifyLoginWidget(widgetData(fresh(), '999:OTHER'), TOKEN, NOW)).toBeNull();
  });

  it('rejects any tampered field, including a swapped ID', async () => {
    const good = widgetData(fresh());
    expect(await verifyLoginWidget({ ...good, id: 1 }, TOKEN, NOW)).toBeNull();
    expect(await verifyLoginWidget({ ...good, first_name: 'Eve' }, TOKEN, NOW)).toBeNull();
    expect(await verifyLoginWidget({ ...good, extra: 'x' }, TOKEN, NOW)).toBeNull();
  });

  it('rejects a missing, empty or wrong hash', async () => {
    const { hash: _hash, ...noHash } = widgetData(fresh());
    expect(await verifyLoginWidget(noHash, TOKEN, NOW)).toBeNull();
    expect(await verifyLoginWidget({ ...noHash, hash: '' }, TOKEN, NOW)).toBeNull();
    expect(await verifyLoginWidget({ ...noHash, hash: 'f'.repeat(64) }, TOKEN, NOW)).toBeNull();
  });

  it('rejects stale and future-dated logins', async () => {
    const old = Math.floor(NOW / 1000) - WIDGET_MAX_AGE_SECONDS - 1;
    expect(await verifyLoginWidget(widgetData(fresh({ auth_date: old })), TOKEN, NOW)).toBeNull();
    const future = Math.floor(NOW / 1000) + 3600;
    expect(await verifyLoginWidget(widgetData(fresh({ auth_date: future })), TOKEN, NOW)).toBeNull();
  });

  it('rejects structured values and bad IDs', async () => {
    expect(await verifyLoginWidget({ ...widgetData(fresh()), id: { $gt: 0 } as never }, TOKEN, NOW)).toBeNull();
    expect(await verifyLoginWidget(widgetData(fresh({ id: -5 })), TOKEN, NOW)).toBeNull();
    expect(await verifyLoginWidget(widgetData(fresh({ id: 1.5 })), TOKEN, NOW)).toBeNull();
  });

  it('accepts an upper-case hash and refuses an empty token', async () => {
    const good = widgetData(fresh());
    expect(await verifyLoginWidget({ ...good, hash: good.hash.toUpperCase() }, TOKEN, NOW)).not.toBeNull();
    expect(await verifyLoginWidget(good, '', NOW)).toBeNull();
  });
});
