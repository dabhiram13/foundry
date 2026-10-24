import { access, lstat, mkdtemp, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

const binary = process.env.FOUNDRY_OPENCODE_QUALIFY_BINARY;
if (process.platform !== 'linux' || !binary || !path.isAbsolute(binary)) throw new Error('Set FOUNDRY_OPENCODE_QUALIFY_BINARY to the explicitly selected OpenCode 1.19.0 Linux executable. This required check cannot skip.');
if (!(await lstat(binary)).isFile()) throw new Error('Selected OpenCode binary is not a file');
await access(binary, constants.X_OK);
const directory = await mkdtemp(path.join(os.tmpdir(), 'foundry-managed-package-'));
const npm = (args) => {
  const result = spawnSync('npm', args, { encoding: 'utf8', timeout: 120_000, maxBuffer: 2_097_152 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Managed package installation failed: ${result.stderr}`);
  return result.stdout;
};
try {
  const [record] = JSON.parse(npm(['pack', '--ignore-scripts', '--json', '--pack-destination', directory]));
  if (path.basename(record.filename) !== record.filename) throw new Error('Invalid package filename');
  npm(['install', '--prefix', directory, '--ignore-scripts', '--no-audit', '--no-fund', path.join(directory, record.filename)]);
  const runtime = path.join(directory, 'node_modules/@dabhiram13/foundry/dist/runtime');
  const result = spawnSync(process.execPath, ['--test', 'dist/runtime-tests/managed-coding.test.cjs'], {
    stdio: 'inherit', timeout: 300_000,
    env: { ...process.env, FOUNDRY_MANAGED_QUALIFICATION: 'required', FOUNDRY_MANAGED_TEST_RUNTIME: runtime },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally { await rm(directory, { recursive: true, force: true }); }
