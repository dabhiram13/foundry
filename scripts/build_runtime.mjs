import { chmod, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const define = { __FOUNDRY_VERSION__: JSON.stringify(metadata.version) };
const runtimeOutput = path.join(root, 'dist/runtime');
const testsOutput = path.join(root, 'dist/runtime-tests');

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? files(fullPath) : [fullPath];
  }));
  return nested.flat();
}

await rm(runtimeOutput, { recursive: true, force: true });
await rm(testsOutput, { recursive: true, force: true });
await mkdir(runtimeOutput, { recursive: true });
await mkdir(testsOutput, { recursive: true });
await build({
  entryPoints: [path.join(root, 'src/cli/foundry.ts')],
  define,
  outfile: path.join(runtimeOutput, 'foundry.cjs'),
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  external: ['node:*'],
  banner: { js: '#!/usr/bin/env node' },
});
await chmod(path.join(runtimeOutput, 'foundry.cjs'), 0o755);
await build({
  entryPoints: [path.join(root, 'src/runtime/worker.ts')],
  outfile: path.join(runtimeOutput, 'foundry-worker.cjs'),
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  external: ['node:*'],
  banner: { js: '#!/usr/bin/env node' },
});
await chmod(path.join(runtimeOutput, 'foundry-worker.cjs'), 0o755);

const testEntries = (await files(path.join(root, 'tests/runtime')))
  .filter((file) => file.endsWith('.test.ts'));
if (testEntries.length) {
  await build({
    entryPoints: testEntries,
    define,
    outdir: testsOutput,
    outbase: path.join(root, 'tests/runtime'),
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'cjs',
    external: ['node:*'],
    outExtension: { '.js': '.cjs' },
  });
}
