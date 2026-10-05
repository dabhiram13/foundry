import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { findings } from '../scripts/security_scan.mjs';
import { validate } from '../scripts/check_catalog.mjs';

test('secret scan reads index blobs rather than a sanitized working copy and never prints matches', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'foundry-scan-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = args => assert.equal(spawnSync('git', args, { cwd: root }).status, 0);
  git(['init', '-q']);
  const tokens = ['AKIA' + 'A'.repeat(16), 'ghp_' + 'a'.repeat(36), 'sk-proj-' + 'a'.repeat(20),
    'xoxb-' + 'a'.repeat(20), 'sk_live_' + 'a'.repeat(16), 'AIza' + 'a'.repeat(35),
    '-----BEGIN ' + 'PRIVATE KEY-----'];
  await writeFile(path.join(root, 'space name.txt'), tokens.join('\n'));
  git(['add', '--', 'space name.txt']);
  await writeFile(path.join(root, 'space name.txt'), 'sanitized working copy\n');
  assert.equal(findings(root).length, tokens.length);
  assert.deepEqual(findings(root), findings(root, true));
  const result = spawnSync(process.execPath, ['scripts/security_scan.mjs', '--root', root], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  for (const token of tokens) assert.ok(!result.stderr.includes(token));
  git(['add', '--', 'space name.txt']);
  assert.deepEqual(findings(root), []);
  await writeFile(path.join(root, 'not-tracked.txt'), tokens[0]);
  assert.deepEqual(findings(root, true), []);
});

test('catalog preserves policy, native-role parsing, path and provenance checks', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'foundry-catalog-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.codex/agents'), { recursive: true });
  await mkdir(path.join(root, '.agents/skills/foundry-start'), { recursive: true });
  await writeFile(path.join(root, '.codex/agents/broken.toml'), '[broken');
  await writeFile(path.join(root, '.agents/skills/foundry-start/SKILL.md'),
    '# Start\nRun scripts/missing.mjs and `foundry work status --project PATH`. Do not use `foundry ui`.\n');
  const errors = validate(root).errors;
  assert.ok(errors.some(error => error.includes('invalid role TOML')));
  assert.ok(errors.some(error => error.includes('explicit-invocation policy')));
  assert.ok(errors.some(error => error.includes('missing referenced executable')));
  assert.ok(errors.some(error => error.includes('unsupported Foundry CLI command ui')));
  assert.ok(errors.some(error => error.includes('missing required workflow skills')));
  await writeFile(path.join(root, '.codex/agents/broken.toml'), 'model = "do-not-pin"\n');
  assert.ok(validate(root).errors.some(error => error.includes('hardcoded model')));
  await mkdir(path.join(root, 'library/skills/session-management'), { recursive: true });
  const guides = ['library/README.md', 'library/skills/session-management/SKILL.md'];
  for (const guide of guides) {
    await writeFile(path.join(root, guide), 'Run `python3 scripts/foundry.py status`.\n');
  }
  for (const guide of guides) {
    assert.ok(validate(root).errors.includes(`removed Python CLI reference in ${guide}`));
    await writeFile(path.join(root, guide), 'Run `foundry work status --project PATH`.\n');
  }
  assert.ok(!validate(root).errors.some(error => error.includes('removed Python CLI reference')));
});
