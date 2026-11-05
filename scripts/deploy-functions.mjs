// Deploys the Edge Functions (all, or the ones named) to one Supabase project.
// Usage: node scripts/deploy-functions.mjs --project <ref> [function ...]
//        or set SUPABASE_PROJECT_REF. Needs `npx supabase login` once.
import { spawnSync } from 'node:child_process';
import { FUNCTIONS } from './functions.mjs';

const args = process.argv.slice(2);
const flag = args.indexOf('--project');
const project = flag >= 0 ? args[flag + 1] : process.env.SUPABASE_PROJECT_REF;
const only = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--project');

if (!project) {
  console.error('Say which project: --project <ref> (or SUPABASE_PROJECT_REF). Development and production are different projects.');
  process.exit(1);
}
const unknown = only.filter((n) => !FUNCTIONS.some((f) => f.name === n));
if (unknown.length) {
  console.error(`Unknown function: ${unknown.join(', ')}`);
  process.exit(1);
}

let failed = 0;
for (const fn of FUNCTIONS.filter((f) => !only.length || only.includes(f.name))) {
  const cliArgs = ['supabase', 'functions', 'deploy', fn.name, '--project-ref', project, '--yes', ...(fn.verifyJwt ? [] : ['--no-verify-jwt'])];
  console.log(`\n> ${fn.name}${fn.verifyJwt ? '' : ' (no JWT check)'}`);
  const r = spawnSync('npx', cliArgs, { stdio: 'inherit', shell: true });
  if (r.status !== 0) failed++;
}
if (failed) {
  console.error(`\n${failed} function(s) failed.`);
  process.exit(1);
}
