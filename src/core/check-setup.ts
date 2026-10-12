import { readdir } from 'node:fs/promises';
import { z } from 'zod';
import { canonicalJson, digest, exists, within } from './fs.js';
import { readBoundedText } from './factory-contract.js';
import type { CheckConfig } from './lifecycle.js';

const packageSchema = z.object({
  scripts: z.record(z.string(), z.string()).default({}),
  packageManager: z.string().optional(),
}).passthrough();

const generated = new Set([
  '.git', '.foundry', '.opencode', 'node_modules', 'dist', 'build', 'coverage',
  '.next', '.nuxt', '.output', '.svelte-kit', '.astro', '.turbo', '.cache', '.yarn',
]);
const locks = {
  npm: ['package-lock.json', 'npm-shrinkwrap.json'],
  pnpm: ['pnpm-lock.yaml'],
  yarn: ['yarn.lock'],
  bun: ['bun.lock', 'bun.lockb'],
} as const;

export interface CheckSetup {
  status: 'existing' | 'proposed' | 'needs_scripts';
  revision: string;
  checks: CheckConfig[];
  existing_checks: number;
  reason: string;
}

export async function previewCheckSetup(root: string, config: { checks: unknown[] }): Promise<CheckSetup> {
  const result = (status: CheckSetup['status'], reason: string, checks: CheckConfig[] = [], source = ''): CheckSetup => ({
    status, reason, checks, existing_checks: config.checks.length,
    revision: digest(canonicalJson({ config, status, checks, source })),
  });
  if (config.checks.length) return result('existing', 'Existing checks are preserved. Review them before starting work.');
  if (!await exists(root, 'package.json')) {
    return result('needs_scripts', 'Create real test or build scripts first, then preview setup again. Other project types need custom check configuration.');
  }
  const { text: source } = await readBoundedText(root, 'package.json', 256 * 1024);
  const manifest = packageSchema.parse(JSON.parse(source));
  let manager: keyof typeof locks = 'npm';
  if (manifest.packageManager !== undefined) {
    const selected = /^(npm|pnpm|yarn|bun)(?:@.+)?$/.exec(manifest.packageManager)?.[1];
    if (!selected) return result('needs_scripts', 'This package manager needs custom check configuration.', [], source);
    manager = selected as keyof typeof locks;
  } else {
    const detected: Array<keyof typeof locks> = [];
    for (const [name, paths] of Object.entries(locks)) {
      if ((await Promise.all(paths.map(file => exists(root, file)))).some(Boolean)) detected.push(name as keyof typeof locks);
    }
    if (detected.length > 1) return result('needs_scripts', 'Multiple package managers found. Set packageManager in package.json, then preview again.', [], source);
    manager = detected[0] ?? 'npm';
  }
  const scripts = ['test', 'build', 'typecheck', 'lint'].filter(name => {
    const script = manifest.scripts[name]?.trim();
    return script && !/no test specified/i.test(script) && !/^(true|exit 0|echo\s+[^;&|]*)$/.test(script);
  });
  if (!scripts.includes('test') && !scripts.includes('build')) {
    return result('needs_scripts', 'Add a real test or build script to package.json, then preview again. Setup does not create tests or run commands.', [], source);
  }
  const inputs = (await readdir(root)).filter(name => !generated.has(name)).sort();
  for (const input of inputs) within(root, input);
  const checks: CheckConfig[] = scripts.map(name => ({
    name, command: [manager, 'run', name], cwd: '.', timeout: 120,
    required: true, inputs, environment: [],
  }));
  return result('proposed', 'Review these scripts and input paths before saving. Setup does not install dependencies or run checks.', checks, source);
}
