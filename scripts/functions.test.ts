import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-expect-error plain JavaScript module shared with the deploy script
import { FUNCTIONS } from './functions.mjs';

const dirs = readdirSync(resolve(process.cwd(), 'supabase/functions'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
  .map((d) => d.name)
  .sort();

describe('the Edge Function deploy list', () => {
  it('names every function in supabase/functions, and nothing else', () => {
    expect((FUNCTIONS as { name: string }[]).map((f) => f.name).sort()).toEqual(dirs);
  });

  it('only functions that Telegram, cron or the sign-in proof call skip the Supabase login check', () => {
    const open = (FUNCTIONS as { name: string; verifyJwt: boolean }[]).filter((f) => !f.verifyJwt).map((f) => f.name).sort();
    expect(open).toEqual(['admin-login', 'broadcast-due', 'telegram-bot', 'telegram-reminders']);
  });

  it('every function that skips the login check checks its own credential', () => {
    const own: Record<string, RegExp> = {
      'telegram-bot': /x-telegram-bot-api-secret-token/,
      'telegram-reminders': /x-cron-secret/,
      'broadcast-due': /x-cron-secret/,
      'admin-login': /verifyInitData|nonceHash/,
    };
    for (const [name, check] of Object.entries(own)) {
      expect(readFileSync(resolve(process.cwd(), `supabase/functions/${name}/index.ts`), 'utf8'), name).toMatch(check);
    }
  });

  it('every other function asks who is calling', () => {
    for (const f of FUNCTIONS as { name: string; verifyJwt: boolean }[]) {
      if (!f.verifyJwt) continue;
      const code = readFileSync(resolve(process.cwd(), `supabase/functions/${f.name}/index.ts`), 'utf8');
      // telegram-auth proves identity with Telegram's signed data instead of a Supabase login
      expect(code, f.name).toMatch(f.name === 'telegram-auth' ? /verifyInitData/ : /requireUser/);
    }
  });
});
