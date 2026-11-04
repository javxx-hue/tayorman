// Builds and deploys the student Mini App to its Vercel project, with the public VITE_* values from an env file
// (default .env; for production use --env-file .env.production). The values are not printed.
// Usage: node scripts/deploy-app.mjs [--env-file <file>]
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const at = args.indexOf('--env-file');
const file = at >= 0 ? args[at + 1] : '.env';
if (!existsSync(file)) {
  console.error(`No ${file}. It must hold VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_TELEGRAM_BOT.`);
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^VITE_[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
);
const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_TELEGRAM_BOT'].filter((k) => !env[k]);
if (missing.length) {
  console.error(`${file} is missing: ${missing.join(', ')}`);
  process.exit(1);
}

const deploy = ['vercel', 'deploy', '--prod', '--yes'];
for (const [k, v] of Object.entries(env)) deploy.push('--build-env', `${k}=${v}`);
const r = spawnSync('npx', deploy, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', shell: process.platform === 'win32' });
console.log(`${r.stdout}\n${r.stderr}`.split('\n').filter((l) => /Aliased|Production|rror/.test(l)).join('\n'));
process.exit(r.status ?? 1);
