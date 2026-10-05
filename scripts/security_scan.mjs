#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const patterns = new Map([
  ['AWS access key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{50,255})\b/],
  ['OpenAI API key', /\bsk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ['Stripe live secret', /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
]);

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, maxBuffer: 32 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error('Cannot read the exact Git index; scan did not complete.');
  return result.stdout;
}

export function findings(root, wholeTracked = false) {
  const paths = git(root, wholeTracked ? ['ls-files', '-z']
    : ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR']).toString('utf8').split('\0').filter(Boolean);
  const hits = [];
  for (const relative of paths) {
    const blob = git(root, ['show', `:${relative}`]);
    if (blob.includes(0)) continue;
    for (const [index, line] of blob.toString('latin1').split(/\r\n|\n|\r/).entries()) {
      for (const [label, pattern] of patterns) {
        if (pattern.test(line)) hits.push({ path: relative, line: index + 1, label });
      }
    }
  }
  return hits;
}

export function main(args = process.argv.slice(2)) {
  try {
    const { values } = parseArgs({ args, options: {
      staged: { type: 'boolean' }, 'whole-tracked': { type: 'boolean' }, root: { type: 'string' },
    } });
    if (values.staged && values['whole-tracked']) throw new Error('Choose staged or whole-tracked, not both.');
    const hits = findings(path.resolve(values.root ?? process.cwd()), values['whole-tracked']);
    if (!hits.length) {
      console.log('security scan: no high-confidence secrets found');
      return 0;
    }
    console.error('security scan: blocked; possible secrets in exact index blobs');
    for (const hit of hits) console.error(`  ${JSON.stringify(hit.path)}:${hit.line}: ${hit.label} [REDACTED]`);
    return 1;
  } catch (error) {
    console.error(`security scan error: ${error.message}`);
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
