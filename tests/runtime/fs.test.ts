import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readdir, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { FoundryError, atomicWrite, within, withProcessLock } from '../../src/core/fs.js';

async function workspace(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'foundry-runtime-fs-'));
  await mkdir(path.join(root, '.foundry'), { recursive: true });
  return root;
}

test('safe paths reject traversal, absolute paths, and symlink escapes', async () => {
  const root = await workspace();
  await mkdir(path.join(root, 'outside'));
  await symlink(path.join(root, 'outside'), path.join(root, 'link'));
  assert.throws(() => within(root, '../outside/file'), FoundryError);
  assert.throws(() => within(root, '/tmp/file'), FoundryError);
  assert.throws(() => within(root, 'link/file'), FoundryError);
});

test('atomic writes do not follow a symlink destination', async () => {
  const root = await workspace();
  await writeFile(path.join(root, 'real.txt'), 'old');
  await symlink(path.join(root, 'real.txt'), path.join(root, 'link.txt'));
  await assert.rejects(atomicWrite(root, 'link.txt', 'new'), FoundryError);
});

test('process lock is fail-closed and released by its owner', async () => {
  const root = await workspace();
  const lock = path.join(root, '.foundry/lock');
  let blocked = false;
  await withProcessLock(lock, async () => {
    await assert.rejects(withProcessLock(lock, async () => undefined), FoundryError);
    blocked = true;
  });
  assert.equal(blocked, true);
  await withProcessLock(lock, async () => undefined);
});

test('process lock recovers only after its recorded owner exits', async () => {
  const root = await workspace();
  const child = spawn(process.execPath, ['-e', 'process.exit(0)']);
  const ownerPid = child.pid;
  await new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', () => resolve());
  });
  assert.ok(ownerPid);
  const lock = path.join(root, '.foundry/lock');
  await mkdir(lock);
  await writeFile(path.join(lock, 'owner.json'), JSON.stringify({ pid: ownerPid, token: 'dead-owner' }));
  await withProcessLock(lock, async () => undefined);
});

test('concurrent reclaimers admit at most one action through a dead lock', async () => {
  const root = await workspace();
  const child = spawn(process.execPath, ['-e', 'process.exit(0)']);
  const ownerPid = child.pid;
  await new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', () => resolve());
  });
  assert.ok(ownerPid);
  const lock = path.join(root, '.foundry/lock');
  await mkdir(lock);
  await writeFile(path.join(lock, 'owner.json'), JSON.stringify({ pid: ownerPid, token: 'dead-owner' }));
  let active = 0;
  let maximum = 0;
  let entered = 0;
  const actions = Array.from({ length: 12 }, () => withProcessLock(lock, async () => {
    entered += 1;
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 50));
    active -= 1;
  }));
  await Promise.allSettled(actions);
  assert.equal(entered, 1);
  assert.equal(maximum, 1);
});

test('an orphaned reclamation guard stays fail-closed', async () => {
  const root = await workspace();
  const lock = path.join(root, '.foundry/lock');
  await mkdir(`${lock}.reclaim`);
  await assert.rejects(withProcessLock(lock, async () => undefined), FoundryError);
});

test('a dead lock with unexpected contents fails closed without deleting them', async () => {
  const root = await workspace();
  const child = spawn(process.execPath, ['-e', 'process.exit(0)']);
  const ownerPid = child.pid;
  await new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', () => resolve());
  });
  assert.ok(ownerPid);
  const lock = path.join(root, '.foundry/lock');
  await mkdir(path.join(lock, 'nested'), { recursive: true });
  await writeFile(path.join(lock, 'nested/keep.txt'), 'keep');
  await writeFile(path.join(lock, 'owner.json'), JSON.stringify({ pid: ownerPid, token: 'dead-owner' }));
  await assert.rejects(withProcessLock(lock, async () => undefined), FoundryError);
  assert.equal(await readFile(path.join(lock, 'nested/keep.txt'), 'utf8'), 'keep');
  await assert.rejects(stat(`${lock}.reclaim`), { code: 'ENOENT' });
});

test('a symlinked lock is refused without touching its target', async () => {
  const root = await workspace();
  const victim = path.join(root, 'victim');
  await mkdir(victim);
  await writeFile(path.join(victim, 'keep.txt'), 'keep');
  await writeFile(path.join(victim, 'owner.json'), JSON.stringify({ pid: 2 ** 31 - 1, token: 'dead-owner' }));
  const lock = path.join(root, '.foundry/lock');
  await symlink(victim, lock, 'dir');
  await assert.rejects(withProcessLock(lock, async () => undefined), /Symlink paths are not allowed/);
  assert.deepEqual((await readdir(victim)).sort(), ['keep.txt', 'owner.json']);
});
