// Looks at one environment from the outside and says what is still missing. Changes nothing, prints no secret.
//   node scripts/check-environment.mjs --url <backend address> [--env supabase/functions/.env.production]
// <backend address> is where the functions are served: https://<ref>.supabase.co for the hosted Supabase, or the
// domain in front of a self-hosted one (the same value as VITE_SUPABASE_URL).
// It checks: which functions answer, whether admin-login is the version with logins and passwords, which values
// are still empty in the env file (names only) and, with TELEGRAM_BOT_TOKEN in that file, where the bot's webhook points.
// Meant for the person who runs that environment; do not point it at someone else's.
import { existsSync, readFileSync } from 'node:fs';
import { FUNCTIONS } from './functions.mjs';
import { adminLoginVersion, classifyFunction, missingKeys, parseEnv, webhookVerdict } from './environment.mjs';

const args = process.argv.slice(2);
const value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const base = (value('--url') ?? '').replace(/\/+$/, '');
const envFile = value('--env');

if (!/^https?:\/\//.test(base)) {
  console.error('Usage: node scripts/check-environment.mjs --url <https://backend address> [--env <file>]');
  process.exit(1);
}

const fnUrl = (name) => `${base}/functions/v1/${name}`;
const status = async (name, init) => {
  try {
    return (await fetch(fnUrl(name), { method: 'POST', signal: AbortSignal.timeout(20_000), ...init })).status;
  } catch {
    return 0;
  }
};
const mark = (ok) => (ok ? 'OK ' : 'XX ');
let problems = 0;
const report = (ok, text) => {
  if (!ok) problems++;
  console.log(`${mark(ok)} ${text}`);
};

console.log(`Checking ${base}\n\nFunctions (an answer of "refused" is right: nobody signed in):`);
for (const fn of FUNCTIONS) {
  const kind = classifyFunction(await status(fn.name));
  report(kind === 'ok', `${fn.name}${kind === 'ok' ? '' : kind === 'missing' ? ' is not deployed' : ' does not answer properly'}`);
}

const login = adminLoginVersion(await status('admin-login', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: 'check.probe', password: 'x' }) }));
report(login === 'new', `admin-login ${login === 'new' ? 'knows logins and passwords' : login === 'old' ? 'is an OLD version (deploy it again)' : 'gave an unexpected answer'}`);

if (envFile) {
  console.log(`\nValues in ${envFile}:`);
  if (!existsSync(envFile)) {
    report(false, 'the file does not exist');
  } else {
    const env = parseEnv(readFileSync(envFile, 'utf8'));
    const missing = missingKeys(env);
    report(missing.length === 0, missing.length ? `still empty: ${missing.join(', ')}` : 'all required values are filled in');

    if (env.TELEGRAM_BOT_TOKEN) {
      console.log('\nTelegram webhook:');
      try {
        const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`, { signal: AbortSignal.timeout(20_000) });
        const verdict = webhookVerdict((await res.json()).result, fnUrl('telegram-bot'));
        report(verdict.ok, verdict.text);
      } catch {
        report(false, 'Telegram did not answer');
      }
    }
  }
}

console.log(problems ? `\n${problems} thing(s) need attention.` : '\nEverything looks right.');
process.exit(problems ? 1 : 0);
