import { describe, it, expect } from 'vitest';
// @ts-expect-error plain JavaScript module shared with the setup script
import { GENERATED, REQUIRED, applyEnv, cronSql, fillSecrets, missingKeys, parseEnv, webhookUrl } from './environment.mjs';

describe('parseEnv', () => {
  it('reads values and skips comments and blanks', () => {
    expect(parseEnv('# note\nA=1\n\nB=\nc = x\r\nD=a=b\n')).toEqual({ A: '1', B: '', D: 'a=b' });
  });
});

describe('fillSecrets', () => {
  it('fills only the empty generated secrets and never replaces one that exists', () => {
    const { env, created } = fillSecrets({ AUTH_SECRET: 'keep-me', CRON_SECRET: '' }, () => 'new');
    expect(env.AUTH_SECRET).toBe('keep-me');
    expect(env.CRON_SECRET).toBe('new');
    expect(env.TELEGRAM_WEBHOOK_SECRET).toBe('new');
    expect(created).toEqual(['CRON_SECRET', 'TELEGRAM_WEBHOOK_SECRET']);
  });

  it('draws a separate value for each secret', () => {
    let n = 0;
    const { env } = fillSecrets({}, () => `v${n++}`);
    expect(new Set(GENERATED.map((k: string) => env[k])).size).toBe(GENERATED.length);
  });
});

describe('missingKeys', () => {
  it('names what is empty', () => {
    const all = Object.fromEntries(REQUIRED.map((k: string) => [k, 'x']));
    expect(missingKeys(all)).toEqual([]);
    expect(missingKeys({ ...all, APP_URL: '', GEMINI_API_KEY: '' })).toEqual(['GEMINI_API_KEY', 'APP_URL']);
  });
});

describe('applyEnv', () => {
  it('changes a line in place, keeps comments, appends unknown keys', () => {
    const out = applyEnv('# secrets\nAUTH_SECRET=\nOTHER=1\n', { AUTH_SECRET: 'abc$&', NEW: 'z' });
    expect(out).toBe('# secrets\nAUTH_SECRET=abc$&\nOTHER=1\nNEW=z\n');
  });
});

describe('cron and webhook', () => {
  it('builds both jobs for this project with its secret', () => {
    const sql = cronSql('abc123', 'S3CRET');
    expect(sql).toContain("cron.schedule('daily-reminders', '0 3 * * *'");
    expect(sql).toContain("cron.schedule('broadcasts-due', '* * * * *'");
    expect(sql).toContain('https://abc123.supabase.co/functions/v1/telegram-reminders');
    expect(sql).toContain('https://abc123.supabase.co/functions/v1/broadcast-due');
    expect(sql.match(/S3CRET/g)).toHaveLength(2);
  });

  it('points the webhook at the bot function', () => {
    expect(webhookUrl('abc123')).toBe('https://abc123.supabase.co/functions/v1/telegram-bot');
  });
});
