import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error plain JavaScript module shared with the backup script
import { backupFiles, copyVerified, newestBackup, oldCopies, pruneCopies, sha256 } from './backup-helpers.mjs';

const names = ['abc-2026-11-05-1348.sql', 'abc-2026-11-12-0900.sql', 'abc-2026-10-29-2210.sql', 'notes.txt', 'abc-2026-11-12-0900.sql.bak'];

describe('backup file names', () => {
  it('keeps only real backups, oldest first', () => {
    expect(backupFiles(names)).toEqual(['abc-2026-10-29-2210.sql', 'abc-2026-11-05-1348.sql', 'abc-2026-11-12-0900.sql']);
  });

  it('finds the newest one, or nothing', () => {
    expect(newestBackup(names)).toBe('abc-2026-11-12-0900.sql');
    expect(newestBackup(['notes.txt'])).toBeNull();
    expect(newestBackup([])).toBeNull();
  });

  it('lists the copies to delete so that the newest N stay', () => {
    expect(oldCopies(names, 2)).toEqual(['abc-2026-10-29-2210.sql']);
    expect(oldCopies(names, 3)).toEqual([]);
    expect(oldCopies(names, 10)).toEqual([]);
    expect(oldCopies(names, 0)).toEqual(backupFiles(names));
  });
});

describe('copying a backup', () => {
  let work: string;
  beforeEach(() => {
    work = mkdtempSync(join(tmpdir(), 'copy-test-'));
  });
  afterEach(() => rmSync(work, { recursive: true, force: true }));

  it('copies into a folder that does not exist yet and proves the copy matches', async () => {
    const src = join(work, 'abc-2026-11-12-0900.sql');
    writeFileSync(src, 'some database dump\n'.repeat(500));
    const { dest, ok } = await copyVerified(src, join(work, 'usb', 'backups'));
    expect(ok).toBe(true);
    expect(existsSync(dest)).toBe(true);
    expect(await sha256(src)).toBe(await sha256(dest));
  });

  it('prunes old copies and leaves other files alone', () => {
    const dir = join(work, 'usb');
    mkdirSync(dir);
    for (const n of ['abc-2026-10-01-0100.sql', 'abc-2026-10-08-0100.sql', 'abc-2026-10-15-0100.sql', 'photos.zip']) writeFileSync(join(dir, n), 'x');
    const gone = pruneCopies(dir, 2);
    expect(gone).toEqual(['abc-2026-10-01-0100.sql']);
    expect(readdirSync(dir).sort()).toEqual(['abc-2026-10-08-0100.sql', 'abc-2026-10-15-0100.sql', 'photos.zip']);
  });

  it('does nothing when the folder is missing', () => {
    expect(pruneCopies(join(work, 'nope'), 3)).toEqual([]);
  });
});
