// Prepares one environment (usually production) from its env file. It never prints a secret.
//   node scripts/setup-environment.mjs --project <ref> --env supabase/functions/.env.production [--webhook]
// 1. fills AUTH_SECRET, CRON_SECRET and TELEGRAM_WEBHOOK_SECRET with random values if they are empty
// 2. lists what is still missing (names only)
// 3. writes the cron jobs SQL next to the env file (paste it in the SQL Editor once)
// 4. with --webhook: points the bot at this project (only after the secrets and functions are in place)
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { GENERATED, applyEnv, cronSql, fillSecrets, missingKeys, parseEnv, webhookUrl } from './environment.mjs';

const args = process.argv.slice(2);
const value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const project = value('--project') ?? process.env.SUPABASE_PROJECT_REF;
const file = value('--env');

if (!project || !file) {
  console.error('Usage: node scripts/setup-environment.mjs --project <ref> --env <file> [--webhook]');
  process.exit(1);
}
if (!existsSync(file)) {
  console.error(`No ${file}. Copy supabase/functions/.env.example to it and fill it in.`);
  process.exit(1);
}

const text = readFileSync(file, 'utf8');
const { env, created } = fillSecrets(parseEnv(text), () => randomBytes(32).toString('hex'));
if (created.length) {
  writeFileSync(file, applyEnv(text, Object.fromEntries(created.map((k) => [k, env[k]]))));
  console.log(`Generated: ${created.join(', ')}`);
} else {
  console.log(`Kept the existing ${GENERATED.join(', ')}`);
}

const missing = missingKeys(env);
if (missing.length) {
  console.log(`\nStill empty in ${file}: ${missing.join(', ')}`);
}

const sqlFile = `${file}.cron.sql`;
writeFileSync(sqlFile, cronSql(project, env.CRON_SECRET));
console.log(`\nCron jobs SQL written to ${sqlFile} (contains a secret, ignored by git).`);

if (args.includes('--webhook')) {
  if (missing.length) {
    console.error('\nNot setting the webhook: fill in the missing values first.');
    process.exit(1);
  }
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl(project), secret_token: env.TELEGRAM_WEBHOOK_SECRET, drop_pending_updates: true }),
  });
  const body = await res.json().catch(() => ({}));
  console.log(body.ok ? `\nWebhook set to ${webhookUrl(project)}` : `\nTelegram refused: ${body.description ?? res.status}`);
  process.exit(body.ok ? 0 : 1);
}
