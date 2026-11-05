// Saves a copy of the data (public tables and accounts) of one Supabase project to backups/, which git ignores.
// Supabase's free plan keeps no backups of its own, so run this regularly (for example every week) and keep
// the files somewhere safe: they hold personal data.
//   node scripts/backup-db.mjs --project <ref>
// Needs Docker running (the Supabase CLI uses it for pg_dump) and a prior `npx supabase login`; no database password
// is needed. Files uploaded to Storage are not part of this copy.
import { mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { backupName } from './environment.mjs';

const args = process.argv.slice(2);
const at = args.indexOf('--project');
const project = at >= 0 ? args[at + 1] : process.env.SUPABASE_PROJECT_REF;

if (!project) {
  console.error('Say which project: --project <ref>. Development and production are different projects.');
  process.exit(1);
}

mkdirSync('backups', { recursive: true });
const file = `backups/${backupName(project, new Date())}`;
const r = spawnSync('npx', ['supabase', 'db', 'dump', `--remote=${project}`, '--data-only', '--use-copy', '--schema', 'public,auth', '--file', file], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});
if (r.status !== 0) {
  rmSync(file, { force: true }); // a failed run leaves an empty file that looks like a backup
  console.error('\nThe backup failed. Is Docker running, and are you logged in (npx supabase login)?');
  process.exit(r.status ?? 1);
}
console.log(`\nSaved ${file}`);
