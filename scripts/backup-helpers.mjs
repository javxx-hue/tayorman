// Small pieces used by scripts/backup-and-copy.mjs. No network and no Docker here, so they can be tested.
import { copyFileSync, createReadStream, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const BACKUP_FILE = /^[a-z0-9]+-\d{4}-\d{2}-\d{2}-\d{4}\.sql$/;

// Backup files are named <project>-YYYY-MM-DD-HHMM.sql, so sorting the names sorts them by time
export const backupFiles = (names) => names.filter((n) => BACKUP_FILE.test(n)).sort();
export const newestBackup = (names) => backupFiles(names).at(-1) ?? null;

// Which copies to delete so that only the newest `keep` remain
export const oldCopies = (names, keep) => backupFiles(names).slice(0, Math.max(0, backupFiles(names).length - keep));

export const sha256 = (file) =>
  new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(file).on('data', (d) => hash.update(d)).on('end', () => resolve(hash.digest('hex'))).on('error', reject);
  });

// Copies a file into a folder and proves the copy is identical
export async function copyVerified(src, destDir) {
  mkdirSync(destDir, { recursive: true });
  const dest = join(destDir, src.split(/[\\/]/).pop());
  copyFileSync(src, dest);
  const ok = (await sha256(src)) === (await sha256(dest));
  return { dest, ok };
}

// Keeps the newest `keep` backups in a folder, removes the rest; returns what it removed
export function pruneCopies(dir, keep) {
  if (!existsSync(dir)) return [];
  const gone = oldCopies(readdirSync(dir), keep);
  for (const name of gone) rmSync(join(dir, name), { force: true });
  return gone;
}
