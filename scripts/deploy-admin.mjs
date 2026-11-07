// Builds the admin site and deploys it as its own Vercel project ("tayyorman-admin").
// The build folder is wiped on every build, so it is copied to .admin-deploy/ which keeps
// the Vercel project link between deploys.
// Usage: node scripts/deploy-admin.mjs [--env <file>] [--project <name>]
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { adminDeployDir } from './environment.mjs';

const args = process.argv.slice(2);
const envFlag = args.indexOf('--env');
const file = envFlag >= 0 ? args[envFlag + 1] : '.env';

const projFlag = args.indexOf('--project');
const projectName = projFlag >= 0 ? args[projFlag + 1] : 'tayyorman-admin';
const deployDir = adminDeployDir(projFlag >= 0 ? projectName : undefined);

let extraEnv = {};
if (existsSync(file)) {
  extraEnv = Object.fromEntries(
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter((l) => /^VITE_[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
  );
}

const run = (cmd, cmdArgs, cwd, env = process.env) => {
  const r = spawnSync(cmd, cmdArgs, { cwd, shell: true, stdio: 'inherit', env });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

// Vercel serves the admin site at the root of its own domain (the own-server build uses /admin/, see vite.admin.config.ts)
run('npm', ['run', 'build:admin'], undefined, { ...process.env, ...extraEnv, ADMIN_BASE: '/' });

const target = deployDir;
mkdirSync(target, { recursive: true });
for (const entry of readdirSync(target)) if (entry !== '.vercel') rmSync(join(target, entry), { recursive: true, force: true });
cpSync('dist-admin', target, { recursive: true });

if (!existsSync(join(target, '.vercel'))) run('npx', ['vercel', 'link', '--yes', '--project', projectName], target);

const deployArgs = ['vercel', 'deploy', '--prod', '--yes'];
for (const [k, v] of Object.entries(extraEnv)) deployArgs.push('--build-env', `${k}=${v}`);
run('npx', deployArgs, target);
