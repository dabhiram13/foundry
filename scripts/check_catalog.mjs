#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import TOML from '@iarna/toml';

const required = 'analytics audit blog deep-interview deploy design discover domain drift emails enhance finish fix-issue fumadocs heal help landing-design logo monitor mvp-build mvp-spec payments pentest performance rate-limit resume schema-sync security sentry seo settings setup skeleton spec start trace verify'.split(' ');
const textRoots = ['.agents', '.codex', '.foundry', 'library'];
const referenceRoots = ['.agents/skills', '.codex/agents', '.foundry/workflows', 'library/skills'];
const machinePath = /\/(?:Users|home)\/[^/\s]+\/(?:Desktop|Documents|Downloads|\.npm|\.cache)(?:\/|\b)/;
const legacyPath = /(?:^|[\s`'"])(?:\.claude\/|~\/.claude(?:\/|\b)|\.foundry\/hooks\/)/;
const legacyCommand = /\bclaude\s+-p\b/;
const legacyNamedPath = /dev\/active\/[^\s`]*\$[a-z][a-z0-9-]*/;
const executable = /(?<![\w/])((?:scripts|\.foundry)\/[A-Za-z0-9_./-]+\.(?:py|sh|mjs|cjs|js))(?![A-Za-z0-9])/g;
const foundryCommand = /`(?:\.\/)?foundry\s+([a-z][a-z-]*)`|^\s*(?:\.\/)?foundry\s+([a-z][a-z-]*)/gm;
const foundryCommands = new Set([
  'help', 'new', 'list', 'status', 'configure', 'run', 'review', 'approve', 'stop', 'recover',
  'roles', 'providers', 'init', 'migrate', 'work', 'provider',
]);
const obsoleteDocs = /(?<![\w./-])docs\/(?:patterns|supabase|tools\/catalog)\//;
const owned = /`((?:\.foundry\/(?:references|philosophy)|\.agents\/skills|\.codex\/agents|library\/skills)\/[^`\n ]+)`/g;
const policy = /^\s*allow_implicit_invocation:\s*false\s*(?:#.*)?$/m;

function files(root, relative = '') {
  if (!existsSync(path.join(root, relative))) return [];
  return readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap(entry => {
    const child = path.join(relative, entry.name);
    if (child === '.foundry/state') return [];
    if (entry.isSymbolicLink()) throw new Error(`Catalog symlink is not allowed: ${child}`);
    return entry.isDirectory() ? files(root, child) : entry.isFile() ? [child] : [];
  });
}

function text(root, relative) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(path.join(root, relative))); }
  catch (error) { if (error instanceof TypeError) return null; throw error; }
}

export function validate(root) {
  const all = textRoots.flatMap(relative => files(root, relative));
  const skills = all.filter(file => /^\.agents\/skills\/foundry-[^/]+\/SKILL\.md$/.test(file));
  const library = all.filter(file => /^library\/skills\/[^/]+\/SKILL\.md$/.test(file));
  const roles = all.filter(file => /^\.codex\/agents\/[^/]+\.toml$/.test(file));
  const errors = [];
  const workflowNames = skills.map(file => path.basename(path.dirname(file)).replace(/^foundry-/, ''));
  const missing = required.filter(name => !workflowNames.includes(name)).sort();
  if (missing.length) errors.push(`missing required workflow skills: ${missing.join(', ')}`);
  for (const [label, count, minimum] of [['library skills', library.length, 67], ['native roles', roles.length, 28]]) {
    if (count < minimum) errors.push(`expected at least ${minimum} ${label}, found ${count}`);
  }
  for (const [name, minimum] of [['patterns', 64], ['supabase', 10], ['tools', 27]]) {
    const count = all.filter(file => file.startsWith(`.foundry/references/source-docs/${name}/`)).length;
    if (count < minimum) errors.push(`expected at least ${minimum} ${name} support docs, found ${count}`);
  }
  for (const skill of skills) {
    const policyFile = path.join(path.dirname(skill), 'agents/openai.yaml');
    if (!existsSync(path.join(root, policyFile)) || !policy.test(text(root, policyFile) ?? '')) {
      errors.push(`missing explicit-invocation policy: ${path.basename(path.dirname(skill))}`);
    }
  }
  for (const role of roles) {
    try {
      const parsed = TOML.parse(text(root, role));
      if (Object.hasOwn(parsed, 'model')) errors.push(`hardcoded model in ${role}`);
    } catch { errors.push(`invalid role TOML ${role}`); }
  }
  const nested = all.filter(file => file.startsWith('library/skills/') && path.basename(file) === 'AGENTS.md');
  if (nested.length) errors.push(`active nested AGENTS files: ${nested.length}`);
  for (const relative of all) {
    const content = text(root, relative);
    if (content === null) continue;
    if (/\bscripts\/foundry\.py\b/.test(content)) errors.push(`removed Python CLI reference in ${relative}`);
    if (machinePath.test(content)) errors.push(`source-machine path in ${relative}`);
    if (referenceRoots.some(prefix => relative.startsWith(`${prefix}/`))) {
      if (legacyPath.test(content) || legacyNamedPath.test(content) || legacyCommand.test(content)) errors.push(`obsolete harness reference in ${relative}`);
      if (obsoleteDocs.test(content)) errors.push(`obsolete uninstalled docs path in ${relative}`);
      for (const match of content.matchAll(foundryCommand)) {
        const command = match[1] ?? match[2];
        if (!foundryCommands.has(command)) errors.push(`unsupported Foundry CLI command ${command} in ${relative}`);
      }
      for (const match of content.matchAll(owned)) {
        const reference = match[1].replace(/[.,;:]+$/, '');
        if (/[{}*<>]/.test(reference) || reference.includes('...')) continue;
        if (!existsSync(path.join(root, reference))) errors.push(`missing framework reference ${reference} in ${relative}`);
      }
    }
    if (['.agents/skills/', '.codex/agents/'].some(prefix => relative.startsWith(prefix))) {
      for (const match of content.matchAll(executable)) {
        if (!existsSync(path.join(root, match[1]))) errors.push(`missing referenced executable ${match[1]} in ${relative}`);
      }
    }
  }
  return { errors, workflows: skills.length, library: library.length, roles: roles.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({ options: { project: { type: 'string' } } });
    const result = validate(path.resolve(values.project ?? fileURLToPath(new URL('../', import.meta.url))));
    if (result.errors.length) throw new Error(`catalog check failed:\n- ${result.errors.join('\n- ')}`);
    console.log(`catalog ok: ${result.workflows} workflows, ${result.library} library skills, ${result.roles} roles`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
