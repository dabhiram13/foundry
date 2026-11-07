import { spawnSync } from 'node:child_process';
import { constants, lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { z } from 'zod';
import { atomicJson, atomicWrite, digest, digestJson, exists, FoundryError, now, within, withProcessLock } from './fs.js';
import { readBoundedText, type FactoryState } from './factory-contract.js';
import { shippedFactoryRoot, withShippedFactory } from './factory.js';
import { WORKFLOW_LEDGER } from './workflow.js';
import { BASE_ENVIRONMENT } from '../runtime/environment.js';

export const DELIVERY_STATE = '.foundry/state/factory/delivery.json';
const DELIVERY_LOCK = '.foundry/state/factory/delivery.lock';
const DELIVERY_BODY = '.foundry/state/factory/delivery-body.md';
export const MAX_FOLLOW_UP_POLLS = 240;
export const MAX_POLLS_PER_WATCH = 60;
const FORGE_ENVIRONMENT = [
  'GH_TOKEN', 'GITHUB_TOKEN', 'GH_ENTERPRISE_TOKEN', 'GITHUB_ENTERPRISE_TOKEN', 'GH_HOST', 'GH_CONFIG_DIR',
  'XDG_CONFIG_HOME', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY',
  'https_proxy', 'http_proxy', 'no_proxy',
];

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const commitSchema = z.string().regex(/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/);
const branchSchema = z.string().min(1).max(200);
const bindingSchema = z.object({
  schema_version: z.literal(1),
  workspace_id: z.string().uuid(),
  run_id: z.string().uuid(),
  ship_sha256: sha256Schema,
  workspace_revision: sha256Schema,
  repository: z.object({
    host: z.string().min(1).max(253),
    owner: z.string().min(1).max(100),
    name: z.string().min(1).max(100),
  }).strict(),
  remote: z.object({
    name: z.string().min(1).max(64),
    url: z.string().min(1).max(2048),
    push_url: z.string().min(1).max(2048),
  }).strict(),
  base: z.object({ branch: branchSchema, commit: commitSchema }).strict(),
  head: z.object({ branch: branchSchema, commit: commitSchema }).strict(),
  forge: z.object({ kind: z.literal('gh'), path: z.string().min(1).max(4096), sha256: sha256Schema }).strict(),
  title: z.string().min(1).max(200),
  body_sha256: sha256Schema,
}).strict();
const checkSchema = z.object({
  name: z.string().min(1).max(200),
  outcome: z.enum(['pending', 'pass', 'fail', 'skipped']),
  url: z.string().max(2048).nullable(),
}).strict();
const observationSchema = z.object({
  observed_at: z.string().min(1).max(64),
  state: z.enum(['open', 'merged', 'closed']),
  head_matches: z.boolean(),
  base_matches: z.boolean(),
  ci: z.enum(['none', 'pending', 'passing', 'failing']),
  checks: z.array(checkSchema).max(100),
  review: z.enum(['none', 'review_required', 'changes_requested', 'approved']),
  next_action: z.string().min(1).max(600),
}).strict();
const effectSchema = z.object({
  status: z.enum(['attempted', 'completed']),
  at: z.string().min(1).max(64),
}).strict();
const recordSchema = z.object({
  schema_version: z.literal(1),
  revision: sha256Schema,
  binding: bindingSchema,
  status: z.enum(['proposed', 'authorized', 'needs_owner', 'pull_request_open', 'merged', 'closed']),
  publication: z.enum(['not_authorized', 'pull_request']),
  proposed_at: z.string().min(1).max(64),
  authorized_at: z.string().min(1).max(64).nullable(),
  push: effectSchema.extend({ outcome: z.enum(['pushed', 'already_present']).nullable() }).strict().nullable(),
  pull_request: effectSchema.extend({
    number: z.number().int().positive().nullable(),
    url: z.string().max(2048).nullable(),
    reused: z.boolean(),
  }).strict().nullable(),
  follow_up: z.object({
    polls_used: z.number().int().min(0).max(MAX_FOLLOW_UP_POLLS),
    max_polls: z.literal(MAX_FOLLOW_UP_POLLS),
    last: observationSchema.nullable(),
  }).strict(),
  attention: z.object({
    code: z.enum([
      'base_moved', 'head_conflict', 'push_failed', 'push_unconfirmed',
      'pull_request_conflict', 'pull_request_failed', 'pull_request_unconfirmed', 'head_changed', 'base_changed',
    ]),
    message: z.string().min(1).max(600),
  }).strict().nullable(),
}).strict();

export type DeliveryBinding = z.infer<typeof bindingSchema>;
export type DeliveryRecord = z.infer<typeof recordSchema>;
type Observation = z.infer<typeof observationSchema>;
type JsonRecord = Record<string, unknown>;

export interface DeliveryRequest {
  repository: string;
  base: string;
  head: string;
  remote?: string;
  forge?: string;
}

export interface WatchOptions {
  polls?: number;
  intervalMs?: number;
}

const pullRequestListSchema = z.array(z.object({
  number: z.number().int().positive(),
  url: z.string().max(2048),
  state: z.enum(['OPEN', 'CLOSED', 'MERGED']),
  headRefName: z.string(),
  headRefOid: z.string(),
  baseRefName: z.string(),
  isCrossRepository: z.boolean().optional(),
}).passthrough()).max(100);
const pullRequestViewSchema = z.object({
  number: z.number().int().positive(),
  url: z.string().max(2048),
  state: z.enum(['OPEN', 'CLOSED', 'MERGED']),
  headRefName: z.string(),
  headRefOid: z.string(),
  baseRefName: z.string(),
  reviewDecision: z.string().nullable().optional(),
  statusCheckRollup: z.array(z.record(z.string(), z.unknown())).max(500).nullable().optional(),
}).passthrough();

function redact(text: string): string {
  return text
    .replace(/(\w+:\/\/)[^@/\s]+@/g, '$1[REDACTED]@')
    .replace(/\b(gh[pousr]_[A-Za-z0-9]{10,}|github_pat_[A-Za-z0-9_]{10,})\b/g, '[REDACTED]')
    .trim()
    .slice(0, 300);
}

function git(root: string, args: string[], timeout = 120_000): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync('git', args, {
    cwd: root,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    encoding: 'utf8',
    timeout,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error) throw new FoundryError(`Delivery could not run git: ${redact(result.error.message)}`);
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function gitValue(root: string, args: string[]): string | null {
  const result = git(root, args, 15_000);
  return result.status === 0 && result.stdout.trim() ? result.stdout.trim() : null;
}

function parseRepository(value: string): DeliveryBinding['repository'] {
  const parts = value.trim().split('/');
  const [host, owner, name] = parts.length === 3 ? parts : ['github.com', parts[0], parts[1]];
  const segment = /^[A-Za-z0-9_.-]{1,100}$/;
  if (parts.length < 2 || parts.length > 3 || !host || !owner || !name
    || !/^[A-Za-z0-9.-]{1,253}$/.test(host) || !segment.test(owner) || !segment.test(name)
    || [owner, name].some((part) => part === '.' || part === '..' || part.endsWith('.git'))) {
    throw new FoundryError('--repository must be OWNER/REPO or HOST/OWNER/REPO');
  }
  return { host: host.toLowerCase(), owner, name };
}

function remoteRepository(url: string): { host: string; path: string } | null {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    if (!['https:', 'ssh:'].includes(parsed.protocol)) return null;
    if (parsed.password || (parsed.protocol === 'https:' && parsed.username)) {
      throw new FoundryError('The remote URL contains embedded credentials. Use a credential helper or SSH key instead.');
    }
    return { host: parsed.hostname.toLowerCase(), path: parsed.pathname.replace(/^\/+/, '') };
  }
  const scp = /^(?:[A-Za-z0-9._-]+@)?([A-Za-z0-9.-]+):(?!\/)(.+)$/.exec(url);
  return scp ? { host: scp[1]!.toLowerCase(), path: scp[2]! } : null;
}

function matchesRepository(url: string, repository: DeliveryBinding['repository']): boolean {
  const parsed = remoteRepository(url);
  if (!parsed) return false;
  const repositoryPath = parsed.path.replace(/\/+$/, '').replace(/\.git$/, '');
  return parsed.host === repository.host
    && repositoryPath.toLowerCase() === `${repository.owner}/${repository.name}`.toLowerCase();
}

function validBranch(root: string, value: string, label: string): string {
  if (!value || value.length > 200 || value.startsWith('-') || /[\s\0]/.test(value)
    || git(root, ['check-ref-format', '--branch', value], 15_000).status !== 0) {
    throw new FoundryError(`--${label} must be a valid branch name`);
  }
  return value;
}

function resolveForge(value: string | undefined): DeliveryBinding['forge'] {
  const requested = value ?? 'gh';
  let candidate: string | null = null;
  if (requested.includes('/') || requested.includes(path.sep)) {
    candidate = path.resolve(requested);
  } else {
    for (const directory of (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)) {
      const option = path.join(directory, requested);
      try {
        if (lstatSync(option).isFile() || lstatSync(option).isSymbolicLink()) {
          candidate = option;
          break;
        }
      } catch {
        continue;
      }
    }
  }
  if (!candidate) throw new FoundryError('No gh command was found. Install GitHub CLI or pass --forge PATH.');
  let resolved: string;
  try {
    resolved = realpathSync(candidate);
    const stats = lstatSync(resolved);
    if (!stats.isFile() || (stats.mode & constants.S_IXUSR) === 0) throw new Error('not executable');
  } catch {
    throw new FoundryError('The selected forge command is not an executable file');
  }
  return { kind: 'gh', path: resolved, sha256: digest(readFileSync(resolved)) };
}

async function pullRequestBody(root: string, state: FactoryState): Promise<string> {
  const ship = await readBoundedText(root, state.ship!.path);
  const summary = String((JSON.parse(ship.text) as JsonRecord).summary ?? '');
  return [
    summary.replace(/\nPublication: not_authorized\s*$/, '').trim(),
    '',
    'Delivered by an owner-authorized Foundry delivery for this exact tested revision.',
    'Foundry does not merge, publish or deploy this change.',
    '',
  ].join('\n');
}

async function localBinding(root: string, state: FactoryState, request: DeliveryRequest): Promise<{
  binding: DeliveryBinding;
  body: string;
}> {
  const repository = parseRepository(request.repository);
  const remote = request.remote ?? 'origin';
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(remote)) throw new FoundryError('--remote must be a Git remote name');
  const base = validBranch(root, request.base, 'base');
  const head = validBranch(root, request.head, 'head');
  if (base === head) throw new FoundryError('--head must name a different branch from --base');
  const url = gitValue(root, ['config', '--get', `remote.${remote}.url`]);
  if (!url) throw new FoundryError(`Git remote ${remote} is not configured in this project`);
  const configuredPush = git(root, ['config', '--get-all', `remote.${remote}.pushurl`], 15_000).stdout
    .split('\n').map((line) => line.trim()).filter(Boolean);
  for (const candidate of [url, ...configuredPush]) {
    if (!matchesRepository(candidate, repository)) {
      throw new FoundryError(`Git remote ${remote} does not point to ${repository.host}/${repository.owner}/${repository.name}`);
    }
  }
  const pushUrl = gitValue(root, ['remote', 'get-url', '--push', remote]);
  if (!pushUrl) throw new FoundryError(`Git remote ${remote} has no push URL`);
  remoteRepository(pushUrl);
  const headCommit = gitValue(root, ['rev-parse', '--verify', 'HEAD^{commit}']);
  if (!headCommit) throw new FoundryError('Delivery needs a committed Git revision');
  const dirty = git(root, [
    'status', '--porcelain=v1', '-z', '--untracked-files=all', '--', '.', ':(exclude,glob)**/.foundry/state/**',
    `:(exclude)${WORKFLOW_LEDGER}`,
  ], 30_000);
  if (dirty.status !== 0) throw new FoundryError('Delivery could not inspect the Git work tree');
  if (dirty.stdout.length) throw new FoundryError('The Git work tree has uncommitted changes. Delivery sends only the tested commit.');
  const baseCommit = gitValue(root, ['rev-parse', '--verify', '--quiet', `refs/remotes/${remote}/${base}^{commit}`]);
  if (!baseCommit) {
    throw new FoundryError(`Fetch the base branch first: git fetch ${remote} ${base}`);
  }
  if (baseCommit === headCommit) throw new FoundryError('The tested commit is already on the base branch; there is nothing to deliver');
  if (git(root, ['merge-base', '--is-ancestor', baseCommit, headCommit], 30_000).status !== 0) {
    throw new FoundryError(`The tested commit does not build on ${remote}/${base}. Delivery will not rewrite history.`);
  }
  const body = await pullRequestBody(root, state);
  const binding = bindingSchema.parse({
    schema_version: 1,
    workspace_id: state.workspace_id,
    run_id: state.lifecycle_run_id,
    ship_sha256: state.ship!.sha256,
    workspace_revision: state.review!.workspace_revision,
    repository,
    remote: { name: remote, url, push_url: pushUrl },
    base: { branch: base, commit: baseCommit },
    head: { branch: head, commit: headCommit },
    forge: resolveForge(request.forge),
    title: state.name,
    body_sha256: digest(body),
  });
  return { binding, body };
}

async function readRecord(root: string): Promise<DeliveryRecord | null> {
  if (!(await exists(root, DELIVERY_STATE))) return null;
  try {
    return recordSchema.parse(JSON.parse((await readBoundedText(root, DELIVERY_STATE, 1024 * 1024)).text));
  } catch (error) {
    throw new FoundryError(`Invalid delivery record: ${(error as Error).message}`, { cause: error });
  }
}

async function saveRecord(root: string, record: DeliveryRecord): Promise<void> {
  await atomicJson(root, DELIVERY_STATE, recordSchema.parse(record));
}

function repositoryName(binding: DeliveryBinding): string {
  const { host, owner, name } = binding.repository;
  return host === 'github.com' ? `${owner}/${name}` : `${host}/${owner}/${name}`;
}

function forgeEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const name of [...BASE_ENVIRONMENT, ...FORGE_ENVIRONMENT]) {
    if (process.env[name] !== undefined) environment[name] = process.env[name];
  }
  return {
    ...environment,
    GH_PROMPT_DISABLED: '1',
    GH_NO_UPDATE_NOTIFIER: '1',
    GH_SPINNER_DISABLED: '1',
    GH_PAGER: 'cat',
    NO_COLOR: '1',
  };
}

function forge(root: string, binding: DeliveryBinding, args: string[]): { ok: boolean; stdout: string; detail: string } {
  let current: string;
  try {
    current = digest(readFileSync(binding.forge.path));
  } catch {
    throw new FoundryError('The authorized forge command is no longer available. Preview delivery again.');
  }
  if (current !== binding.forge.sha256) {
    throw new FoundryError('The authorized forge command changed. Preview delivery again.');
  }
  const result = spawnSync(binding.forge.path, args, {
    cwd: root,
    env: forgeEnvironment(),
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) return { ok: false, stdout: '', detail: redact(result.error.message) };
  return { ok: result.status === 0, stdout: result.stdout, detail: redact(result.stderr || `exit ${String(result.status)}`) };
}

function remoteHeads(root: string, binding: DeliveryBinding): Map<string, string> {
  const result = git(root, [
    'ls-remote', '--heads', binding.remote.name,
    `refs/heads/${binding.base.branch}`, `refs/heads/${binding.head.branch}`,
  ]);
  if (result.status !== 0) {
    throw new FoundryError(`Delivery could not read ${binding.remote.name}: ${redact(result.stderr)}`);
  }
  const heads = new Map<string, string>();
  for (const line of result.stdout.split('\n')) {
    const [commit, ref] = line.trim().split(/\s+/);
    if (commit && ref?.startsWith('refs/heads/')) heads.set(ref.slice('refs/heads/'.length), commit);
  }
  return heads;
}

function listPullRequests(root: string, binding: DeliveryBinding): z.infer<typeof pullRequestListSchema> {
  const result = forge(root, binding, [
    'pr', 'list', '--repo', repositoryName(binding), '--head', binding.head.branch, '--state', 'all',
    '--limit', '20', '--json', 'number,url,state,headRefName,headRefOid,baseRefName,isCrossRepository',
  ]);
  if (!result.ok) throw new FoundryError(`Delivery could not list pull requests: ${result.detail}`);
  try {
    return pullRequestListSchema.parse(JSON.parse(result.stdout))
      .filter((item) => item.headRefName === binding.head.branch && item.isCrossRepository !== true);
  } catch (error) {
    throw new FoundryError('The forge returned an unexpected pull request list', { cause: error });
  }
}

function needsOwner(record: DeliveryRecord, code: NonNullable<DeliveryRecord['attention']>['code'], message: string): DeliveryRecord {
  record.status = 'needs_owner';
  record.attention = { code, message };
  return record;
}

export function deliveryView(record: DeliveryRecord | null): JsonRecord {
  if (!record) {
    return {
      status: 'not_requested',
      publication: 'not_authorized',
      next: 'Preview a delivery with deliver PROJECT --repository OWNER/REPO --base BRANCH --head BRANCH.',
    };
  }
  const { binding } = record;
  const next = record.attention?.message
    ?? (record.status === 'proposed'
      ? `Review this delivery, then run deliver PROJECT --apply --revision ${record.revision}.`
      : record.status === 'pull_request_open'
        ? record.follow_up.last?.next_action ?? 'Watch checks and review with deliver PROJECT --watch.'
        : record.follow_up.last?.next_action ?? 'Nothing else to do.');
  return {
    status: record.status,
    publication: record.publication,
    revision: record.revision,
    repository: repositoryName(binding),
    remote: binding.remote.name,
    push_url: binding.remote.push_url,
    base: `${binding.base.branch} @ ${binding.base.commit}`,
    head: `${binding.head.branch} @ ${binding.head.commit}`,
    forge: binding.forge.path,
    title: binding.title,
    actions: [
      `Push tested commit ${binding.head.commit} to a new branch ${binding.head.branch} on ${binding.remote.name}. No force push.`,
      `Open one pull request into ${binding.base.branch}, or reuse an identical open one.`,
      'Watch checks and review only when asked, within a limited number of polls.',
      'Never merge, publish or deploy.',
    ],
    credentials: 'Uses your own Git and gh sign-in. Foundry does not read, store or share tokens.',
    authorized_at: record.authorized_at,
    push: record.push,
    pull_request: record.pull_request,
    follow_up: {
      polls_used: record.follow_up.polls_used,
      polls_left: MAX_FOLLOW_UP_POLLS - record.follow_up.polls_used,
      last: record.follow_up.last,
    },
    attention: record.attention,
    next,
  };
}

export async function deliveryStatus(rootInput: string): Promise<JsonRecord> {
  const root = await shippedFactoryRoot(rootInput);
  return deliveryView(await readRecord(root));
}

export async function previewDelivery(rootInput: string, request: DeliveryRequest): Promise<JsonRecord> {
  return withShippedFactory(rootInput, async (root, state) => withProcessLock(within(root, DELIVERY_LOCK), async () => {
    const { binding } = await localBinding(root, state, request);
    const revision = digestJson(binding);
    const existing = await readRecord(root);
    if (existing && existing.revision === revision) return deliveryView(existing);
    if (existing && existing.status !== 'proposed') {
      const unresolved = existing.push?.status === 'attempted' || existing.pull_request?.status === 'attempted';
      if (existing.status !== 'needs_owner' || unresolved || existing.pull_request?.status === 'completed') {
        throw new FoundryError('An authorized delivery already exists for this project. Inspect it with deliver PROJECT.');
      }
    }
    const record: DeliveryRecord = {
      schema_version: 1,
      revision,
      binding,
      status: 'proposed',
      publication: 'not_authorized',
      proposed_at: now(),
      authorized_at: null,
      push: null,
      pull_request: null,
      follow_up: { polls_used: 0, max_polls: MAX_FOLLOW_UP_POLLS, last: null },
      attention: null,
    };
    await saveRecord(root, record);
    return deliveryView(record);
  }));
}

function pushDecision(record: DeliveryRecord, heads: Map<string, string>): 'done' | 'conflict' | 'push' {
  const { binding } = record;
  if (record.push?.status === 'completed') return 'done';
  const remoteHead = heads.get(binding.head.branch);
  if (remoteHead === binding.head.commit) {
    record.push = { status: 'completed', at: now(), outcome: record.push ? 'pushed' : 'already_present' };
    return 'done';
  }
  if (remoteHead) {
    needsOwner(record, 'head_conflict', `Branch ${binding.head.branch} already exists on ${binding.remote.name} at another commit. Choose a new --head branch; Foundry will not overwrite it.`);
    return 'conflict';
  }
  return 'push';
}

export async function applyDelivery(rootInput: string, revision: string): Promise<JsonRecord> {
  if (!/^[a-f0-9]{64}$/.test(revision)) throw new FoundryError('Delivery revision must be a SHA-256 digest');
  return withShippedFactory(rootInput, async (root, state) => withProcessLock(within(root, DELIVERY_LOCK), async () => {
    const record = await readRecord(root);
    if (!record || record.revision !== revision) {
      throw new FoundryError('Authorization must match the revision of the current delivery preview');
    }
    if (record.pull_request?.status === 'completed' || ['merged', 'closed'].includes(record.status)) {
      return deliveryView(record);
    }
    const request: DeliveryRequest = {
      repository: repositoryName(record.binding),
      base: record.binding.base.branch,
      head: record.binding.head.branch,
      remote: record.binding.remote.name,
      forge: record.binding.forge.path,
    };
    const { binding, body } = await localBinding(root, state, request);
    if (digestJson(binding) !== record.revision) {
      throw new FoundryError('Delivery inputs changed after the preview. Preview delivery again.');
    }
    record.authorized_at ??= now();
    record.status = 'authorized';
    record.attention = null;
    await saveRecord(root, record);

    let heads = remoteHeads(root, binding);
    if (heads.get(binding.base.branch) !== binding.base.commit) {
      needsOwner(record, 'base_moved', `${binding.base.branch} on ${binding.remote.name} no longer matches ${binding.base.commit}. Update the project and ship again, then preview a new delivery.`);
      await saveRecord(root, record);
      return deliveryView(record);
    }
    const decision = pushDecision(record, heads);
    if (decision === 'conflict') {
      await saveRecord(root, record);
      return deliveryView(record);
    }
    if (decision === 'push') {
      record.push = { status: 'attempted', at: now(), outcome: null };
      await saveRecord(root, record);
      const pushed = git(root, [
        'push', '--porcelain', binding.remote.name, `${binding.head.commit}:refs/heads/${binding.head.branch}`,
      ], 300_000);
      heads = remoteHeads(root, binding);
      if (heads.get(binding.head.branch) === binding.head.commit) {
        record.push = { status: 'completed', at: now(), outcome: 'pushed' };
      } else {
        needsOwner(record, pushed.status === 0 ? 'push_unconfirmed' : 'push_failed', pushed.status === 0
          ? 'The push finished but the branch was not found afterwards. Inspect the remote, then authorize again with the same revision.'
          : `The push failed: ${redact(pushed.stderr) || 'no details'}. Fix access, then authorize again with the same revision.`);
        await saveRecord(root, record);
        return deliveryView(record);
      }
    }
    await saveRecord(root, record);

    const matches = listPullRequests(root, binding);
    const reusable = matches.find((item) => item.state === 'OPEN' && item.baseRefName === binding.base.branch
      && item.headRefOid === binding.head.commit);
    if (!reusable && matches.length) {
      needsOwner(record, 'pull_request_conflict', `Pull request #${matches[0]!.number} already uses ${binding.head.branch} with a different base, commit or state. Inspect it; Foundry will not reopen or edit it.`);
      await saveRecord(root, record);
      return deliveryView(record);
    }
    let opened = reusable;
    if (!opened) {
      record.pull_request = { status: 'attempted', at: now(), number: null, url: null, reused: false };
      await saveRecord(root, record);
      await atomicWrite(root, DELIVERY_BODY, body);
      const created = forge(root, binding, [
        'pr', 'create', '--repo', repositoryName(binding), '--base', binding.base.branch,
        '--head', binding.head.branch, '--title', binding.title, '--body-file', within(root, DELIVERY_BODY),
      ]);
      opened = listPullRequests(root, binding).find((item) => item.state === 'OPEN'
        && item.baseRefName === binding.base.branch && item.headRefOid === binding.head.commit);
      if (!opened) {
        needsOwner(record, created.ok ? 'pull_request_unconfirmed' : 'pull_request_failed', created.ok
          ? 'The pull request was requested but could not be found afterwards. Inspect the repository, then authorize again with the same revision.'
          : `The pull request could not be opened: ${created.detail}. Fix access, then authorize again with the same revision.`);
        await saveRecord(root, record);
        return deliveryView(record);
      }
    }
    record.pull_request = {
      status: 'completed',
      at: now(),
      number: opened.number,
      url: opened.url,
      reused: Boolean(reusable) && record.pull_request?.status !== 'attempted',
    };
    record.status = 'pull_request_open';
    record.publication = 'pull_request';
    record.attention = null;
    await saveRecord(root, record);
    return deliveryView(record);
  }));
}

function checkOutcome(item: Record<string, unknown>): z.infer<typeof checkSchema> {
  const name = String(item.name ?? item.context ?? 'check').slice(0, 200) || 'check';
  const rawUrl = item.detailsUrl ?? item.targetUrl;
  const url = typeof rawUrl === 'string' && rawUrl.startsWith('https://') ? rawUrl.slice(0, 2048) : null;
  if (item.__typename === 'StatusContext' || (item.state !== undefined && item.status === undefined)) {
    const state = String(item.state ?? '').toUpperCase();
    return { name, url, outcome: state === 'SUCCESS' ? 'pass' : ['PENDING', 'EXPECTED', ''].includes(state) ? 'pending' : 'fail' };
  }
  if (String(item.status ?? '').toUpperCase() !== 'COMPLETED') return { name, url, outcome: 'pending' };
  const conclusion = String(item.conclusion ?? '').toUpperCase();
  return {
    name,
    url,
    outcome: conclusion === 'SUCCESS' ? 'pass' : ['NEUTRAL', 'SKIPPED'].includes(conclusion) ? 'skipped' : 'fail',
  };
}

function observe(root: string, record: DeliveryRecord): Observation {
  const { binding } = record;
  const result = forge(root, binding, [
    'pr', 'view', String(record.pull_request!.number), '--repo', repositoryName(binding), '--json',
    'number,url,state,headRefName,headRefOid,baseRefName,reviewDecision,statusCheckRollup',
  ]);
  if (!result.ok) throw new FoundryError(`Delivery could not read the pull request: ${result.detail}`);
  let view: z.infer<typeof pullRequestViewSchema>;
  try {
    view = pullRequestViewSchema.parse(JSON.parse(result.stdout));
  } catch (error) {
    throw new FoundryError('The forge returned an unexpected pull request view', { cause: error });
  }
  const checks = (view.statusCheckRollup ?? []).map(checkOutcome).slice(0, 100);
  const ci: Observation['ci'] = !checks.length ? 'none'
    : checks.some((check) => check.outcome === 'fail') ? 'failing'
      : checks.some((check) => check.outcome === 'pending') ? 'pending' : 'passing';
  const decision = String(view.reviewDecision ?? '').toUpperCase();
  const review: Observation['review'] = decision === 'APPROVED' ? 'approved'
    : decision === 'CHANGES_REQUESTED' ? 'changes_requested'
      : decision === 'REVIEW_REQUIRED' ? 'review_required' : 'none';
  const state: Observation['state'] = view.state === 'MERGED' ? 'merged' : view.state === 'CLOSED' ? 'closed' : 'open';
  const headMatches = view.headRefOid === binding.head.commit && view.headRefName === binding.head.branch;
  const baseMatches = view.baseRefName === binding.base.branch;
  const failed = checks.filter((check) => check.outcome === 'fail').map((check) => check.name);
  const nextAction = state === 'merged' ? 'The pull request was merged outside Foundry. Foundry did not merge or deploy it.'
    : state === 'closed' ? 'The pull request was closed. Preview a new delivery to try again.'
      : !headMatches ? 'The pull request branch changed after delivery. Inspect it; Foundry will not overwrite it.'
        : !baseMatches ? 'The pull request base branch changed after delivery. Inspect it before continuing.'
          : ci === 'failing' ? `Checks failed: ${failed.slice(0, 10).join(', ')}. Repair the product and ship a new revision; Foundry will not merge.`
            : ci === 'pending' ? 'Checks are still running. Run deliver PROJECT --watch again later.'
              : ci === 'none' ? 'No checks have reported yet. Run deliver PROJECT --watch again later.'
                : review === 'approved' ? 'Checks passed and the review is approved. Merging is your decision.'
                  : review === 'changes_requested' ? 'Checks passed, but review requested changes.'
                    : 'Checks passed. Waiting for review; merging is your decision.';
  return observationSchema.parse({
    observed_at: now(),
    state,
    head_matches: headMatches,
    base_matches: baseMatches,
    ci,
    checks,
    review,
    next_action: nextAction.slice(0, 600),
  });
}

function settled(observation: Observation): boolean {
  return observation.state !== 'open' || !observation.head_matches || !observation.base_matches
    || observation.ci === 'passing' || observation.ci === 'failing';
}

export async function watchDelivery(rootInput: string, options: WatchOptions = {}): Promise<JsonRecord> {
  const root = await shippedFactoryRoot(rootInput);
  const requested = options.polls ?? 20;
  const intervalMs = options.intervalMs ?? 30_000;
  if (!Number.isSafeInteger(requested) || requested < 1 || requested > MAX_POLLS_PER_WATCH) {
    throw new FoundryError(`--polls must be between 1 and ${MAX_POLLS_PER_WATCH}`);
  }
  if (!Number.isFinite(intervalMs) || intervalMs < 0 || intervalMs > 300_000) {
    throw new FoundryError('--interval must be at most 300 seconds');
  }
  return withProcessLock(within(root, DELIVERY_LOCK), async () => {
    const record = await readRecord(root);
    if (!record || record.pull_request?.status !== 'completed' || record.pull_request.number === null) {
      throw new FoundryError('No authorized pull request to watch. Preview and authorize a delivery first.');
    }
    if (['merged', 'closed'].includes(record.status)) return deliveryView(record);
    const remaining = MAX_FOLLOW_UP_POLLS - record.follow_up.polls_used;
    if (remaining <= 0) throw new FoundryError('The follow-up limit for this delivery is used up. Inspect the pull request directly.');
    const polls = Math.min(requested, remaining);
    for (let index = 0; index < polls; index += 1) {
      if (index > 0 && intervalMs > 0) await sleep(intervalMs);
      const observation = observe(root, record);
      record.follow_up.polls_used += 1;
      record.follow_up.last = observation;
      record.attention = null;
      record.status = observation.state === 'merged' ? 'merged'
        : observation.state === 'closed' ? 'closed' : 'pull_request_open';
      if (observation.state === 'open' && !observation.head_matches) {
        needsOwner(record, 'head_changed', observation.next_action);
      } else if (observation.state === 'open' && !observation.base_matches) {
        needsOwner(record, 'base_changed', observation.next_action);
      }
      await saveRecord(root, record);
      if (settled(observation)) break;
    }
    return deliveryView(record);
  });
}
