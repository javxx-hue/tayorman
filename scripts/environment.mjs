// Pure helpers for setting up one environment (development or production). No network, no file access,
// so they can be tested; scripts/setup-environment.mjs does the real work with them.

export const GENERATED = ['AUTH_SECRET', 'CRON_SECRET', 'TELEGRAM_WEBHOOK_SECRET'];
export const REQUIRED = ['GEMINI_API_KEY', 'TELEGRAM_BOT_TOKEN', 'ADMIN_TELEGRAM_IDS', 'APP_URL', 'ADMIN_URL', 'ALLOWED_ORIGINS', ...GENERATED];

// "A=1\n# note\nB=" -> { A: '1', B: '' }
export function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

// Gives every generated secret a value if it has none. Existing values are never replaced:
// changing AUTH_SECRET after people signed in would lock them out of their accounts.
export function fillSecrets(env, random) {
  const next = { ...env };
  const created = [];
  for (const key of GENERATED) {
    if (!next[key]) {
      next[key] = random();
      created.push(key);
    }
  }
  return { env: next, created };
}

export const missingKeys = (env) => REQUIRED.filter((k) => !env[k]);

// Writes values into the env text, keeping comments and order; a key not in the text is appended.
export function applyEnv(text, values) {
  let out = text.replace(/\r\n/g, '\n');
  for (const [key, value] of Object.entries(values)) {
    const line = new RegExp(`^${key}=.*$`, 'm');
    out = line.test(out) ? out.replace(line, () => `${key}=${value}`) : `${out.replace(/\n*$/, '\n')}${key}=${value}\n`;
  }
  return out;
}

// The two scheduled jobs from the README (step 5). The secret is inside, so the file is never committed.
export function cronSql(projectRef, cronSecret) {
  const job = (name, schedule, fn) => `select cron.schedule('${name}', '${schedule}', $$
  select net.http_post(
    url := 'https://${projectRef}.supabase.co/functions/v1/${fn}',
    headers := jsonb_build_object('x-cron-secret', '${cronSecret}')
  );
$$);`;
  return [
    '-- Run once in the SQL Editor of this project. Contains a secret: never commit or share it.',
    job('daily-reminders', '0 3 * * *', 'telegram-reminders'), // 08:00 Tashkent
    job('broadcasts-due', '* * * * *', 'broadcast-due'),
    '',
  ].join('\n\n');
}

export const webhookUrl = (projectRef) => `https://${projectRef}.supabase.co/functions/v1/telegram-bot`;
