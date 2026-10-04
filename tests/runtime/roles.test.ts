import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { loadRoles } from '../../src/core/roles.js';

test('the copied neutral role inventory has 28 policies without hard-coding that count in the schema', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'foundry-runtime-roles-'));
  await mkdir(path.join(root, '.foundry'), { recursive: true });
  const roles = await readFile(path.resolve('.foundry/roles.json'), 'utf8');
  await import('node:fs/promises').then(({ writeFile }) => writeFile(path.join(root, '.foundry/roles.json'), roles));
  assert.equal((await loadRoles(root)).length, 28);
});
