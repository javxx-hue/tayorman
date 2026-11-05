import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SCRIPT = resolve(process.cwd(), 'scripts/backup-selfhosted.sh');
const hasBash = spawnSync('bash', ['--version']).status === 0;

// A stand-in "docker" on the PATH, so the script can be run without a server
let work: string;
const fakeDocker = (body: string) => {
  const bin = join(work, 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'docker'), `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(join(bin, 'docker'), 0o755);
  return bin;
};
const run = (bin: string, env: Record<string, string> = {}) => {
  const dir = join(work, 'backups');
  const posix = (p: string) => p.replace(/\\/g, '/');
  return spawnSync('bash', [posix(SCRIPT)], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${posix(bin)}:${process.env.PATH}`, BACKUP_DIR: posix(dir), ...env },
  });
};
const files = () => (existsSync(join(work, 'backups')) ? readdirSync(join(work, 'backups')) : []);

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), 'backup-test-'));
});
afterEach(() => rmSync(work, { recursive: true, force: true }));

describe.skipIf(!hasBash)('backup-selfhosted.sh', () => {
  it('saves a dump, names the file by time and tells the size', () => {
    const r = run(fakeDocker('head -c 5000 /dev/zero'));
    expect(r.status).toBe(0);
    expect(files()).toHaveLength(1);
    expect(files()[0]).toMatch(/^db-\d{4}-\d{2}-\d{2}-\d{6}\.dump$/);
    expect(r.stdout).toContain('5000 bytes');
  });

  it('asks the right container and database', () => {
    const bin = fakeDocker('echo "$@" >&2; head -c 2000 /dev/zero');
    const r = run(bin, { DB_CONTAINER: 'my-db', DB_USER: 'admin', DB_NAME: 'app' });
    expect(r.stderr).toContain('exec my-db pg_dump -U admin -d app -Fc');
  });

  it('leaves no file behind when the dump fails', () => {
    const r = run(fakeDocker('head -c 3000 /dev/zero; exit 1'));
    expect(r.status).not.toBe(0);
    expect(files()).toEqual([]);
  });

  it('refuses a dump that is far too small to be real', () => {
    const r = run(fakeDocker('echo "Error: no such container"'));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('something is wrong');
    expect(files()).toEqual([]);
  });

  it('deletes backups older than KEEP_DAYS and keeps newer ones', () => {
    const dir = join(work, 'backups');
    mkdirSync(dir, { recursive: true });
    const old = join(dir, 'db-2020-01-01-000000.dump');
    const recent = join(dir, 'db-2099-01-01-000000.dump');
    for (const f of [old, recent]) writeFileSync(f, 'x');
    const longAgo = new Date(Date.now() - 40 * 24 * 3600 * 1000);
    utimesSync(old, longAgo, longAgo);
    const r = run(fakeDocker('head -c 4000 /dev/zero'), { KEEP_DAYS: '14' });
    expect(r.status).toBe(0);
    const left = files();
    expect(left).not.toContain('db-2020-01-01-000000.dump');
    expect(left).toContain('db-2099-01-01-000000.dump');
    expect(left).toHaveLength(2); // the recent one and the new one
  });

  it('does not touch other files in the folder', () => {
    const dir = join(work, 'backups');
    mkdirSync(dir, { recursive: true });
    const other = join(dir, 'notes.txt');
    writeFileSync(other, 'keep me');
    const longAgo = new Date(Date.now() - 400 * 24 * 3600 * 1000);
    utimesSync(other, longAgo, longAgo);
    run(fakeDocker('head -c 4000 /dev/zero'), { KEEP_DAYS: '1' });
    expect(files()).toContain('notes.txt');
  });
});
