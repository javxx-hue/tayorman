// One command for the weekly backup: takes the database backup, copies it to another place (a flash drive, a
// synced folder) and proves the copy is identical.
//   npm run backup:copy -- --project <ref> --to E:\tayyorman-backups [--keep 12]
// Needs Docker running and `npx supabase login` (see scripts/backup-db.mjs). The copy folder can also be set once with
// the BACKUP_COPY_DIR environment variable. The files hold personal data: keep the drive private.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { copyVerified, newestBackup, pruneCopies } from './backup-helpers.mjs';

const args = process.argv.slice(2);
const value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const project = value('--project') ?? process.env.SUPABASE_PROJECT_REF;
const target = value('--to') ?? process.env.BACKUP_COPY_DIR;
const keep = Number(value('--keep') ?? 12);

if (!project || !target) {
  console.error('Usage: npm run backup:copy -- --project <ref> --to <folder> [--keep 12]');
  process.exit(1);
}
if (!Number.isInteger(keep) || keep < 1) {
  console.error('--keep must be a whole number, 1 or more.');
  process.exit(1);
}

const run = spawnSync('node', ['scripts/backup-db.mjs', '--project', project], { stdio: 'inherit', shell: true });
if (run.status !== 0) process.exit(run.status ?? 1);

const newest = newestBackup(readdirSync('backups'));
if (!newest) {
  console.error('No backup file found in backups/.');
  process.exit(1);
}

const { dest, ok } = await copyVerified(`backups/${newest}`, target);
if (!ok) {
  console.error(`The copy ${dest} does NOT match the original. Do not rely on it; run the command again.`);
  process.exit(1);
}
const removed = pruneCopies(target, keep);
console.log(`\nCopied and verified: ${dest}`);
if (removed.length) console.log(`Removed ${removed.length} older copy(ies) from ${target} (keeping the newest ${keep}).`);
