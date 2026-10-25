import { mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

if (process.platform !== 'linux' || !process.env.FOUNDRY_WORKSPACE_QUALIFY_IMAGE) throw new Error('Select a local digest-pinned image with FOUNDRY_WORKSPACE_QUALIFY_IMAGE. This required check cannot skip.');
const directory = await mkdtemp(path.join(os.tmpdir(), 'foundry-workspace-package-'));
const npm = args => {
  const result = spawnSync('npm', args, { encoding: 'utf8', timeout: 120_000, maxBuffer: 2_097_152 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Workspace package installation failed: ${result.stderr}`);
  return result.stdout;
};
try {
  const [record] = JSON.parse(npm(['pack', '--ignore-scripts', '--json', '--pack-destination', directory]));
  if (path.basename(record.filename) !== record.filename) throw new Error('Invalid package filename');
  npm(['install', '--prefix', directory, '--ignore-scripts', '--no-audit', '--no-fund', path.join(directory, record.filename)]);
  const runtime = path.join(directory, 'node_modules/@dabhiram13/foundry/dist/runtime');
  const result = spawnSync(process.execPath, ['--test', 'dist/runtime-tests/isolated-workspace.test.cjs'], {
    stdio: 'inherit', timeout: 120_000,
    env: { ...process.env, FOUNDRY_WORKSPACE_QUALIFICATION: 'required', FOUNDRY_MANAGED_TEST_RUNTIME: runtime },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally { await rm(directory, { recursive: true, force: true }); }
