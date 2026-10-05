import { chmod, copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

function mcpSdkCjsPlugin() {
  const packagePath = '@modelcontextprotocol/sdk';
  return {
    name: 'mcp-sdk-commonjs',
    setup(buildOptions) {
      buildOptions.onResolve({ filter: /^@modelcontextprotocol\/sdk(?:\/.*)?$/ }, (args) => {
        const entry = args.path === packagePath ? 'index.js' : args.path.slice(packagePath.length + 1);
        return { path: path.join(root, 'node_modules/@modelcontextprotocol/sdk/dist/cjs', entry) };
      });
    },
  };
}

await rm(path.join(runtimeOutput, 'project.cjs'), { force: true });
await mkdir(path.join(runtimeOutput, 'assets'), { recursive: true });
await mkdir(testsOutput, { recursive: true });
await build({
  entryPoints: [path.join(root, 'src/cli/foundry.ts')],
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
  entryPoints: [path.join(root, 'src/transports/worker.ts')],
  outfile: path.join(runtimeOutput, 'foundry-worker.cjs'),
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  external: ['node:*'],
  banner: { js: '#!/usr/bin/env node' },
});
await chmod(path.join(runtimeOutput, 'foundry-worker.cjs'), 0o755);
await copyFile(path.join(root, '.foundry/roles.json'), path.join(runtimeOutput, 'assets/roles.json'));

const testEntries = (await files(path.join(root, 'tests/runtime')))
  .filter((file) => file.endsWith('.test.ts'));
if (testEntries.length) {
  await build({
    entryPoints: testEntries,
    outdir: testsOutput,
    outbase: path.join(root, 'tests/runtime'),
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'cjs',
    external: ['node:*'],
    plugins: [mcpSdkCjsPlugin()],
    outExtension: { '.js': '.cjs' },
  });
}
