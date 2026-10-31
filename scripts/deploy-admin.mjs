// Builds the admin site and deploys it as its own Vercel project ("tayyorman-admin").
// The build folder is wiped on every build, so it is copied to .admin-deploy/ which keeps
// the Vercel project link between deploys.
// Usage: node scripts/deploy-admin.mjs
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const run = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, shell: true, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

run('npm', ['run', 'build:admin']);

const target = '.admin-deploy';
mkdirSync(target, { recursive: true });
for (const entry of readdirSync(target)) if (entry !== '.vercel') rmSync(join(target, entry), { recursive: true, force: true });
cpSync('dist-admin', target, { recursive: true });

if (!existsSync(join(target, '.vercel'))) run('npx', ['vercel', 'link', '--yes', '--project', 'tayyorman-admin'], target);
run('npx', ['vercel', 'deploy', '--prod', '--yes'], target);
