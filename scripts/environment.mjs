// Pure helpers for setting up one environment (development or production). No network, no file access,
// so they can be tested; scripts/setup-environment.mjs does the real work with them.

export const GENERATED = ['AUTH_SECRET', 'CRON_SECRET', 'TELEGRAM_WEBHOOK_SECRET'];
export const REQUIRED = ['GEMINI_API_KEY', 'TELEGRAM_BOT_TOKEN', 'ADMIN_TELEGRAM_IDS', 'OWNER_TELEGRAM_IDS', 'APP_URL', 'ADMIN_URL', 'ALLOWED_ORIGINS', ...GENERATED];

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
export function cronSql(baseUrl, cronSecret) {
  const job = (name, schedule, fn) => `select cron.schedule('${name}', '${schedule}', $$
  select net.http_post(
    url := '${baseUrl}/functions/v1/${fn}',
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

// The address functions are served from: https://<ref>.supabase.co on the hosted Supabase, or the domain in front of a self-hosted one
export const backendUrl = (projectRef, url) => (url ?? `https://${projectRef}.supabase.co`).replace(/\/+$/, '');
export const webhookUrl = (baseUrl) => `${baseUrl}/functions/v1/telegram-bot`;

// backups/<project>-2026-11-05-1530.sql (minutes included so two backups in a day do not overwrite each other)
export function backupName(projectRef, date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${projectRef}-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}.sql`;
}

// What an unauthenticated POST to a function tells us: 404 = it is not deployed; 5xx = deployed but broken;
// anything else (401, 403, 400, 405) means it exists and refused us, which is exactly right.
export function classifyFunction(status) {
  if (status === 404) return 'missing';
  if (status >= 500 || status === 0) return 'broken';
  return 'ok';
}

// admin-login with a made-up login: the version that knows logins and passwords answers 403 (denied),
// the older one does not understand the body and answers 400.
export const adminLoginVersion = (status) => (status === 403 ? 'new' : status === 400 ? 'old' : 'unknown');

// Telegram's getWebhookInfo against where the bot should point. An empty url usually means a long-polling
// script (the old scripts/bot.mjs, now removed from the repo, may still be running on a server) took the bot over:
// it deletes the webhook when it starts.
export function webhookVerdict(info, expectedUrl) {
  if (!info?.url) return { ok: false, text: 'no webhook is set (is the old bot.mjs polling script still running on the server? it removes the webhook)' };
  if (info.url !== expectedUrl) return { ok: false, text: `points to ${info.url}, expected ${expectedUrl}` };
  if (info.last_error_message) return { ok: false, text: `set, but Telegram reports: ${info.last_error_message}` };
  return { ok: true, text: `set${info.pending_update_count ? `, ${info.pending_update_count} updates waiting` : ''}` };
}

// "ID    prj_xxxx" out of `vercel project inspect <name>`
export function parseProjectId(text) {
  return text.match(/\bID\s+(prj_[A-Za-z0-9]+)/)?.[1] ?? null;
}

// Each Vercel project gets its own folder for the admin site's deploy link, so deploying to a test project never
// replaces the link of the real one
export const adminDeployDir = (projectName) => (projectName ? `.admin-deploy-${projectName}` : '.admin-deploy');
