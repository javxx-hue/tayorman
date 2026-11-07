// Builds and deploys the student Mini App to its Vercel project, with the public VITE_* values from an env file
// (default .env; for production use --env .env.production). The values are not printed.
// Usage: node scripts/deploy-app.mjs [--env <file>] [--project <vercel project name>]
// --project deploys to another Vercel project of the same team (for example the test one) without changing the repo's link.
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parseProjectId } from './environment.mjs';

const args = process.argv.slice(2);
const at = args.indexOf('--env');
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

let vercelEnv = process.env;
const projectAt = args.indexOf('--project');
if (projectAt >= 0) {
  const name = args[projectAt + 1];
  const inspect = spawnSync('npx', ['vercel', 'project', 'inspect', name], { encoding: 'utf8', shell: process.platform === 'win32' });
  const projectId = parseProjectId(`${inspect.stdout}
${inspect.stderr}`);
  if (!projectId || !existsSync('.vercel/project.json')) {
    console.error(`Could not find the Vercel project "${name}" (or the repo is not linked to a Vercel team yet).`);
    process.exit(1);
  }
  vercelEnv = { ...process.env, VERCEL_ORG_ID: JSON.parse(readFileSync('.vercel/project.json', 'utf8')).orgId, VERCEL_PROJECT_ID: projectId };
}

const deploy = ['vercel', 'deploy', '--prod', '--yes'];
for (const [k, v] of Object.entries(env)) deploy.push('--build-env', `${k}=${v}`);
const r = spawnSync('npx', deploy, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', shell: process.platform === 'win32', env: vercelEnv });
console.log(`${r.stdout}\n${r.stderr}`.split('\n').filter((l) => /Aliased|Production|rror/.test(l)).join('\n'));
process.exit(r.status ?? 1);
