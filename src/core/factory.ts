import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  atomicJson, atomicWrite, digest, digestJson, exists, FoundryError, now, within, withProcessLock,
} from './fs.js';
import {
  activeRun, complete as lifecycleComplete, configuredChecks, recover as lifecycleRecover,
  pauseOrResume as lifecyclePauseOrResume, requireRuntimeWorkspace, start as lifecycleStart,
  verify as lifecycleVerify, workspaceRevision,
} from './lifecycle.js';
import {
  FACTORY_CANCEL, FACTORY_CANCEL_LOCK, FACTORY_LOCK, FACTORY_STATE, FACTORY_STAGE_LABELS,
  FACTORY_STAGES, assertFactoryShipGate, factoryShipSchema, readBoundedText, readFactoryState,
  reviewEvidenceDigests, writeFactoryState, type FactoryStage, type FactoryState,
} from './factory-contract.js';
import { approvedCriteria, validateReview } from './review.js';
import { loadRoles, roleByName } from './roles.js';
import { context as workflowContext, gate as workflowGate, record as workflowRecord } from './workflow.js';
import {
  cancel as cancelProvider, execute as executeProvider, providerStatus, reconcile as reconcileProvider,
  registry,
} from '../runtime/providers.js';

const IDEA = 'docs/product/idea.md';
const RESEARCH = 'docs/product/research.md';
const PLAN = 'docs/specs/product.md';
const DESIGN = 'docs/product/design.md';
const TASKS = 'docs/product/tasks.md';
const REQUIRED_CAPABILITIES = ['tools', 'jsonl', 'cancel', 'permissions'];
const MAX_FAILURE_MESSAGE = 'Factory stage failed; inspect the saved local receipt before retrying.';
const DEFAULT_ROLES: FactoryState['roles'] = {
  research: 'market-researcher',
  scope: 'planner',
  design: 'designer',
  build: 'backend',
  verify: 'quality-gate',
  release: 'complete',
};
type JsonRecord = Record<string, unknown>;

function slug(name: string): string {
  const value = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(value)) {
    throw new FoundryError('Workspace name must produce a lowercase slug with at most 80 characters');
  }
  return value;
}

function safeFailure(
  stage: FactoryStage,
  code: NonNullable<FactoryState['failure']>['code'],
): NonNullable<FactoryState['failure']> {
  return { stage, code, message: MAX_FAILURE_MESSAGE, at: now() };
}

function hasCapability(adapter: { capabilities: readonly string[] }, capability: string): boolean {
  return adapter.capabilities.includes(capability);
}

async function requireController(rootInput: string, action: string): Promise<string> {
  return requireRuntimeWorkspace(rootInput, action);
}

async function save(root: string, state: FactoryState): Promise<void> {
  state.updated_at = now();
  await writeFactoryState(root, state);
}

async function load(root: string): Promise<FactoryState> {
  const state = await readFactoryState(root);
  if (!state) throw new FoundryError('Factory is not initialized. Run factory init in this TypeScript workspace.');
  return state;
}

async function digestDocument(root: string, relative: string): Promise<string | null> {
  if (!(await exists(root, relative))) return null;
  const { bytes } = await readBoundedText(root, relative);
  return digest(bytes);
}

function documentKey(relative: string): keyof FactoryState['documents'] | null {
  if (relative === IDEA) return 'idea';
  if (relative === RESEARCH) return 'research';
  if (relative === PLAN) return 'plan';
  if (relative === DESIGN) return 'design';
  if (relative === TASKS) return 'tasks';
  return null;
}

async function documentDigests(root: string): Promise<FactoryState['documents']> {
  const values = await Promise.all([IDEA, RESEARCH, PLAN, DESIGN, TASKS].map((file) => digestDocument(root, file)));
  return {
    idea: values[0] ?? '',
    research: values[1] ?? null,
    plan: values[2] ?? null,
    design: values[3] ?? null,
    tasks: values[4] ?? null,
  };
}

function completedBefore(state: FactoryState, stage: FactoryStage): FactoryStage[] {
  const index = FACTORY_STAGES.indexOf(stage);
  return state.completed_stages.filter((item) => FACTORY_STAGES.indexOf(item) < index) as FactoryStage[];
}

function addCompleted(state: FactoryState, stage: FactoryStage): void {
  state.completed_stages = [...new Set([...state.completed_stages, stage])] as FactoryStage[];
}

function invalidateFrom(state: FactoryState, stage: FactoryStage): void {
  state.completed_stages = completedBefore(state, stage);
  state.stage = stage;
  state.provider_task_id = null;
  state.provider_stage = null;
  state.verification_receipt = null;
  state.review = null;
  state.ship = null;
  state.build_tasks = [];
  if (FACTORY_STAGES.indexOf(stage) <= FACTORY_STAGES.indexOf('design')) state.workflow_criteria = [];
  if (FACTORY_STAGES.indexOf(stage) <= FACTORY_STAGES.indexOf('scope')) state.approvals.plan = null;
  if (FACTORY_STAGES.indexOf(stage) <= FACTORY_STAGES.indexOf('design')) state.approvals.design = null;
  if (FACTORY_STAGES.indexOf(stage) <= FACTORY_STAGES.indexOf('research')) {
    state.documents.research = null;
    state.documents.plan = null;
    state.documents.design = null;
    state.documents.tasks = null;
  } else if (FACTORY_STAGES.indexOf(stage) <= FACTORY_STAGES.indexOf('scope')) {
    state.documents.plan = null;
    state.documents.design = null;
    state.documents.tasks = null;
  } else if (FACTORY_STAGES.indexOf(stage) <= FACTORY_STAGES.indexOf('design')) {
    state.documents.design = null;
    state.documents.tasks = null;
  } else {
    state.documents.tasks = null;
  }
  state.status = stage === 'scope' || stage === 'design' ? 'awaiting_approval' : 'ready';
  state.failure = null;
}

async function reconcileDocuments(root: string, state: FactoryState): Promise<boolean> {
  const current = await documentDigests(root);
  let changed = false;
  if (current.idea !== state.documents.idea) {
    state.documents.idea = current.idea;
    invalidateFrom(state, 'research');
    changed = true;
  } else if (state.documents.research !== current.research) {
    state.documents.research = current.research;
    invalidateFrom(state, 'scope');
    changed = true;
  } else if (state.approvals.plan && current.plan !== state.approvals.plan.revision) {
    state.documents.plan = current.plan;
    invalidateFrom(state, 'scope');
    changed = true;
  } else if (state.approvals.design && current.design !== state.approvals.design.revision) {
    state.documents.design = current.design;
    invalidateFrom(state, 'design');
    changed = true;
  } else if (state.documents.plan !== current.plan && state.stage !== 'scope') {
    state.documents.plan = current.plan;
    invalidateFrom(state, 'scope');
    changed = true;
  } else if (state.documents.design !== current.design && state.stage !== 'design') {
    state.documents.design = current.design;
    invalidateFrom(state, 'design');
    changed = true;
  } else if (state.documents.tasks !== current.tasks) {
    invalidateFrom(state, 'build');
    state.documents.tasks = current.tasks;
    changed = true;
  }
  if (!state.documents.idea && current.idea) {
    state.documents.idea = current.idea;
    changed = true;
  }
  return changed;
}

const upstreamPaths: Record<FactoryStage, readonly string[]> = {
  research: [IDEA],
  scope: [IDEA, RESEARCH],
  design: [IDEA, RESEARCH, PLAN],
  build: [IDEA, RESEARCH, PLAN, DESIGN, TASKS],
  verify: [IDEA, PLAN, DESIGN, TASKS],
  release: [IDEA, PLAN, DESIGN],
};

async function captureUpstream(
  root: string,
  stage: FactoryStage,
  allowMissingTasks = false,
): Promise<Record<string, string>> {
  const captured: Record<string, string> = {};
  for (const relative of upstreamPaths[stage]) {
    const revision = await digestDocument(root, relative);
    if (!revision && allowMissingTasks && relative === TASKS) continue;
    if (!revision) throw new FoundryError(`Required upstream document is missing: ${relative}`);
    captured[relative] = revision;
  }
  return captured;
}

async function ensureUpstreamUnchanged(
  root: string,
  state: FactoryState,
  captured: Record<string, string>,
): Promise<void> {
  for (const [relative, expected] of Object.entries(captured)) {
    if (await digestDocument(root, relative) !== expected) {
      await reconcileDocuments(root, state);
      await save(root, state);
      throw new FoundryError(`Upstream input changed while the factory stage was running: ${relative}`);
    }
  }
}

async function selectedRoles(root: string, roles: FactoryState['roles']): Promise<void> {
  await loadRoles(root);
  for (const stage of FACTORY_STAGES) {
    const role = await roleByName(root, roles[stage]);
    if (stage === 'verify' && role.sandbox !== 'read-only') {
      throw new FoundryError('The Test role must declare read-only guidance');
    }
    if (stage !== 'verify' && role.sandbox !== 'workspace-write') {
      throw new FoundryError(`The ${stage} role must declare workspace-write guidance`);
    }
  }
}

async function selectedAdapter(
  root: string,
  name: string,
  model: string | null,
  reasoning: string | null,
  billing: FactoryState['billing'],
): Promise<void> {
  for (const [label, value] of [['model', model], ['reasoning', reasoning]] as const) {
    if (value !== null && (!value.trim() || value.length > 120 || /[\r\n]/.test(value))) {
      throw new FoundryError(`Factory ${label} preference must be a single line of at most 120 characters`);
    }
  }
  const adapters = await registry(root);
  const adapter = adapters[name];
  if (!adapter) throw new FoundryError(`Unknown provider adapter: ${name}`);
  if (adapter.kind !== 'agent-runtime') throw new FoundryError('Factory stages require an agent-runtime adapter');
  for (const capability of REQUIRED_CAPABILITIES) {
    if (!hasCapability(adapter, capability)) throw new FoundryError(`Adapter lacks required capability: ${capability}`);
  }
  if (!adapter.billing_modes.includes(billing.mode)) throw new FoundryError(`Adapter does not support ${billing.mode} billing`);
  if (billing.mode === 'subscription' && !billing.confirmed) {
    throw new FoundryError('Subscription billing requires explicit confirmation');
  }
  if (model && !hasCapability(adapter, 'model_selection')) throw new FoundryError('Adapter lacks model_selection capability');
  if (reasoning && !hasCapability(adapter, 'reasoning_selection')) throw new FoundryError('Adapter lacks reasoning_selection capability');
}

function cancellationPath(root: string): string {
  return within(root, FACTORY_CANCEL);
}

function cancellationRequested(root: string): boolean {
  try {
    return existsSync(cancellationPath(root));
  } catch {
    return true;
  }
}

async function clearCancellation(root: string): Promise<void> {
  await rm(cancellationPath(root), { force: true });
}

function stagePrompt(stage: FactoryStage, state: FactoryState, role: {
  name: string; description: string; instructions: string;
}, task?: string, repair = false): string {
  const paths = stage === 'research' ? `${IDEA} and ${RESEARCH}`
    : stage === 'scope' ? `${IDEA}, ${RESEARCH} and ${PLAN}`
      : stage === 'design' ? `${PLAN} and ${DESIGN}`
        : stage === 'build' ? `${PLAN}, ${DESIGN}, ${TASKS} and the product source`
          : `${PLAN}, ${DESIGN}, the product source and saved verification receipts`;
  const taskText = task ? `\nWork only on this bounded task: ${task}` : '';
  const repairText = repair
    ? '\nThis is a bounded repair attempt. Inspect the saved check receipt and fix the product; never weaken or delete a check.'
    : '';
  return [
    `You are the ${role.name} role in the installed TypeScript project CLI factory preview.`,
    role.description,
    role.instructions,
    `The current stage is ${FACTORY_STAGE_LABELS[stage]}. Work only inside the workspace and inspect ${paths}.`,
    `The installed runtime command is node .foundry/runtime/project.cjs; do not invoke Python, Codex, another controller, or external publication.${taskText}${repairText}`,
    'Keep credentials, tokens, account data and API keys out of files and output.',
    `Factory workspace: ${state.name}.`,
  ].join('\n\n');
}

async function providerRequest(
  root: string,
  state: FactoryState,
  stage: FactoryStage,
  prompt: string,
  readOnly: boolean,
): Promise<JsonRecord> {
  const role = await roleByName(root, state.roles[stage]);
  return {
    adapter: state.adapter,
    kind: state.kind,
    prompt: stagePrompt(stage, state, role, prompt),
    required_capabilities: [...REQUIRED_CAPABILITIES],
    permissions: { sandbox: readOnly ? 'read-only' : 'workspace-write' },
    model: state.model,
    reasoning: state.reasoning,
    billing: {
      mode: state.billing.mode,
      confirmed: state.billing.confirmed,
      allow_api: false,
      acknowledge_posthoc_cost: false,
    },
    budget: {
      max_attempts: 1,
      max_concurrency: 1,
      max_elapsed_seconds: 600,
      max_api_dollars: 0,
    },
  };
}

function resultTaskId(result: JsonRecord): string {
  if (typeof result.task_id !== 'string') throw new FoundryError('Provider result did not include a task ID');
  return result.task_id;
}

function resultStatus(result: JsonRecord): string {
  return typeof result.status === 'string' ? result.status : 'unknown';
}

function storedWorkflowRecord(record: JsonRecord): JsonRecord {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'freshness' && key !== 'reasons'));
}

async function assertWorkflowCriteria(root: string, state: FactoryState): Promise<void> {
  if (!state.workflow_criteria.length) throw new FoundryError('Required verify criteria were not frozen before Build');
  const saved = await workflowContext(root);
  const records = saved.records as JsonRecord[];
  const verifyCriteria = records.filter((record) => record.kind === 'criterion' && record.stage === 'verify');
  const requiredCriteria = verifyCriteria.filter((record) => record.required === true);
  const activeRequired = verifyCriteria.filter((record) => record.required === true
    && record.status === 'accepted' && record.freshness === 'active');
  if (requiredCriteria.length !== state.workflow_criteria.length
    || activeRequired.length !== state.workflow_criteria.length) {
    throw new FoundryError('Accepted required verify criteria changed during Build');
  }
  const checks = await configuredChecks(root);
  for (const frozen of state.workflow_criteria) {
    const matches = activeRequired.filter((record) => record.id === frozen.id);
    if (matches.length !== 1) throw new FoundryError(`Required verify criterion ${frozen.id} was dropped or duplicated`);
    const record = matches[0];
    if (!record || record.expected !== frozen.expected
      || JSON.stringify(record.command) !== JSON.stringify(frozen.command)
      || JSON.stringify(record.inputs) !== JSON.stringify(frozen.inputs)
      || digestJson(storedWorkflowRecord(record)) !== frozen.fingerprint) {
      throw new FoundryError(`Required verify criterion ${frozen.id} changed during Build`);
    }
    const mappedChecks = checks.filter((check) => check.required
      && check.name === frozen.check_name
      && JSON.stringify(check.command) === JSON.stringify(frozen.command)
      && JSON.stringify(check.inputs) === JSON.stringify(frozen.inputs));
    if (mappedChecks.length !== 1) {
      throw new FoundryError(`Required verify criterion ${frozen.id} no longer maps to one required configured check`);
    }
  }
}

async function freezeWorkflowCriteria(root: string, state: FactoryState): Promise<void> {
  if (state.workflow_criteria.length) {
    await assertWorkflowCriteria(root, state);
    return;
  }
  const saved = await workflowContext(root);
  let records = saved.records as JsonRecord[];
  let criteria = records.filter((record) => record.kind === 'criterion' && record.stage === 'verify'
    && record.required === true && record.status === 'accepted' && record.freshness === 'active');
  if (!criteria.length) {
    if (records.some((record) => record.kind === 'criterion' && record.stage === 'verify')) {
      throw new FoundryError('Existing verify criteria must be active and accepted before Build');
    }
    const requiredChecks = (await configuredChecks(root)).filter((check) => check.required);
    if (!requiredChecks.length || requiredChecks.some((check) => !check.inputs.length)) {
      throw new FoundryError('Build needs real required checks with declared inputs for workflow evidence');
    }
    const check = requiredChecks[0];
    if (!check) throw new FoundryError('No required configured check is available');
    for (const criterion of state.approvals.plan?.criteria ?? []) {
      await workflowRecord(root, {
        id: criterion.id,
        kind: 'criterion',
        title: criterion.expected.slice(0, 120),
        source: { kind: 'owner', ref: PLAN, observed_at: now() },
        basis: 'observed',
        status: 'accepted',
        stage: 'verify',
        required: true,
        expected: criterion.expected,
        method: 'command',
        command: check.command,
        inputs: check.inputs,
        accepted_by: 'factory-approve',
        acceptance_ref: state.approvals.plan?.revision,
      });
    }
    records = (await workflowContext(root)).records as JsonRecord[];
    criteria = records.filter((record) => record.kind === 'criterion' && record.stage === 'verify'
      && record.required === true && record.status === 'accepted' && record.freshness === 'active');
  }
  const approved = state.approvals.plan?.criteria ?? [];
  const checks = (await configuredChecks(root)).filter((check) => check.required);
  if (criteria.length !== approved.length || criteria.some((record) => {
    const criterion = approved.find((item) => item.id === record.id);
    return !criterion || record.expected !== criterion.expected || record.method !== 'command'
      || !Array.isArray(record.command) || !Array.isArray(record.inputs)
      || checks.filter((check) => JSON.stringify(check.command) === JSON.stringify(record.command)
        && JSON.stringify(check.inputs) === JSON.stringify(record.inputs)).length !== 1;
  }) || approved.some((criterion) => !criteria.some((record) => record.id === criterion.id))) {
    throw new FoundryError('Required verify criteria must preserve every approved ID, expectation and check mapping');
  }
  state.workflow_criteria = criteria.map((record) => ({
    id: String(record.id),
    expected: String(record.expected),
    command: record.command as string[],
    inputs: record.inputs as string[],
    check_name: String(checks.find((check) => JSON.stringify(check.command) === JSON.stringify(record.command)
      && JSON.stringify(check.inputs) === JSON.stringify(record.inputs))?.name),
    fingerprint: digestJson(storedWorkflowRecord(record)),
  }));
  await assertWorkflowCriteria(root, state);
  await save(root, state);
}

async function assertControllerStateUnchanged(root: string, state: FactoryState): Promise<void> {
  let persisted: FactoryState | null = null;
  try {
    persisted = await readFactoryState(root);
  } catch {
    // A provider turn cannot adopt malformed controller state as new authority.
  }
  if (!persisted || digestJson(persisted) !== digestJson(state)) {
    state.status = 'recovery_required';
    state.failure = safeFailure(state.stage, 'recovery');
    await save(root, state);
    throw new FoundryError('Factory controller state changed during a provider turn');
  }
}

async function assertLifecycleIdentity(root: string, state: FactoryState): Promise<void> {
  if (!state.lifecycle_run_id) return;
  const [, lifecycle] = await activeRun(root);
  if (!lifecycle || lifecycle.run_id !== state.lifecycle_run_id
    || !['building', 'verified'].includes(lifecycle.status)) {
    state.status = 'recovery_required';
    state.failure = safeFailure(state.stage, 'recovery');
    await save(root, state);
    throw new FoundryError('Factory lifecycle identity changed during a provider turn');
  }
}

async function readProviderStatus(root: string, taskId: string): Promise<JsonRecord> {
  const result = await providerStatus(root, taskId);
  if (Array.isArray(result)) throw new FoundryError('Provider status returned a task list unexpectedly');
  return result;
}

async function runProvider(
  root: string,
  state: FactoryState,
  stage: FactoryStage,
  prompt: string,
  readOnly = false,
  captured?: Record<string, string>,
): Promise<JsonRecord> {
  if (cancellationRequested(root)) throw new FoundryError('Factory cancellation requested');
  if (stage === 'build') await freezeWorkflowCriteria(root, state);
  const upstream = captured ?? await captureUpstream(root, stage);
  const request = await providerRequest(root, state, stage, prompt, readOnly);
  let startedId: string | null = null;
  const result = await executeProvider(root, request, undefined, {
    onStarted: async (taskId: string) => {
      startedId = taskId;
      state.provider_task_id = taskId;
      state.provider_stage = stage;
      state.status = 'running';
      await save(root, state);
      if (cancellationRequested(root)) {
        try {
          await cancelProvider(root, taskId);
        } catch {
          // The provider may not have persisted its running state yet.
        }
      }
    },
  });
  await assertControllerStateUnchanged(root, state);
  await assertLifecycleIdentity(root, state);
  const status = resultStatus(result);
  if (cancellationRequested(root) || status === 'canceled' || status === 'interrupted') {
    throw new FoundryError('Factory cancellation requested');
  }
  if (status !== 'completed') {
    if (status === 'unknown' || status === 'timed_out') {
      state.status = 'recovery_required';
      await save(root, state);
    }
    throw new FoundryError(`Provider stage ended ${status}`);
  }
  await ensureUpstreamUnchanged(root, state, upstream);
  if (stage === 'build') await assertWorkflowCriteria(root, state);
  if (!startedId) throw new FoundryError('Provider did not establish a task before execution');
  return result;
}

function outputFromResult(result: JsonRecord): unknown {
  const attempts = result.attempts;
  if (!Array.isArray(attempts) || !attempts.length) throw new FoundryError('Provider review did not return an attempt');
  const attempt = attempts[attempts.length - 1];
  if (typeof attempt !== 'object' || attempt === null || Array.isArray(attempt)) {
    throw new FoundryError('Provider review attempt is malformed');
  }
  const output = (attempt as JsonRecord).output;
  if (typeof output !== 'string') return output;
  try {
    return JSON.parse(output) as unknown;
  } catch (error) {
    throw new FoundryError('Provider review output must be strict JSON', { cause: error });
  }
}

async function parseTasks(root: string): Promise<string[]> {
  const file = await readBoundedText(root, TASKS);
  const titles: string[] = [];
  for (const line of file.text.split(/\r?\n/)) {
    const match = /^- \[[ x]\] (.+)$/.exec(line);
    if (match?.[1]) titles.push(match[1].trim().slice(0, 300));
  }
  if (!titles.length) throw new FoundryError('Build task checklist needs at least one "- [ ] task" item');
  if (titles.length > 12) throw new FoundryError('Build task checklist exceeds the 12-task bound');
  if (new Set(titles).size !== titles.length) throw new FoundryError('Build task checklist contains duplicate tasks');
  return titles;
}

async function tickTask(root: string, title: string): Promise<void> {
  const file = await readBoundedText(root, TASKS);
  const lines = file.text.split(/(?<=\n)/);
  let found = false;
  let changed = false;
  const output = lines.map((line) => {
    if (!found && new RegExp(`^- \\[([ x])\\] ${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\r?\\n)?$`).test(line)) {
      found = true;
      if (line.startsWith('- [ ]')) {
        changed = true;
        return line.replace('- [ ]', '- [x]');
      }
    }
    return line;
  }).join('');
  if (!found) throw new FoundryError(`Build task is missing from ${TASKS}: ${title}`);
  if (changed) await atomicWrite(root, TASKS, output);
}

function checkpoint(root: string, message: string): string | null {
  const environment = { ...process.env };
  const git = (...args: string[]) => spawnSync('git', args, {
    cwd: root, env: environment, encoding: 'utf8', timeout: 120_000,
  });
  if (git('rev-parse', '--is-inside-work-tree').status !== 0) {
    throw new FoundryError('Build checkpoint requires a Git work tree');
  }
  if (git('var', 'GIT_AUTHOR_IDENT').status !== 0) {
    environment.GIT_AUTHOR_NAME = 'Foundry';
    environment.GIT_AUTHOR_EMAIL = 'foundry@localhost';
    environment.GIT_COMMITTER_NAME = 'Foundry';
    environment.GIT_COMMITTER_EMAIL = 'foundry@localhost';
  }
  const added = git('add', '-A', '--', '.', ':(exclude).foundry/state/**');
  if (added.status !== 0) throw new FoundryError('Build checkpoint could not stage product changes');
  const diff = git('diff', '--cached', '--quiet');
  if (diff.status === 0) return null;
  if (diff.status !== 1) throw new FoundryError('Build checkpoint could not inspect staged changes');
  const committed = git('commit', '-q', '-m', message.slice(0, 200));
  if (committed.status !== 0) throw new FoundryError('Build checkpoint could not commit verified product changes');
  const head = git('rev-parse', 'HEAD');
  if (head.status !== 0 || !head.stdout.trim()) throw new FoundryError('Build checkpoint did not produce a Git revision');
  return head.stdout.trim();
}

async function markTaskEvidence(root: string, state: FactoryState): Promise<void> {
  await assertWorkflowCriteria(root, state);
  const saved = await workflowContext(root);
  const records = saved.records as JsonRecord[];
  const checks = await configuredChecks(root);
  const approved = state.approvals.plan?.criteria ?? [];
  const existing = records.filter((record) => record.kind === 'criterion'
    && record.stage === 'verify' && record.required === true && record.status === 'accepted'
    && record.freshness === 'active');
  if (existing.length !== state.workflow_criteria.length) {
    throw new FoundryError('Accepted required verify criteria changed before Test evidence recording');
  }
  const refreshed = (await workflowContext(root)).records as JsonRecord[];
  const criteria = refreshed.filter((record) => record.kind === 'criterion'
    && record.stage === 'verify' && record.required === true && record.status === 'accepted'
    && record.freshness === 'active');
  if (criteria.length !== approved.length || criteria.some((record) => {
    const match = approved.find((criterion) => criterion.id === record.id);
    return !match || record.expected !== match.expected || record.method !== 'command'
      || !Array.isArray(record.command)
      || !checks.some((check) => check.required && JSON.stringify(check.command) === JSON.stringify(record.command)
        && JSON.stringify(check.inputs) === JSON.stringify(record.inputs));
  }) || approved.some((criterion) => !criteria.some((record) => record.id === criterion.id))) {
    throw new FoundryError('Required accepted verify criteria must preserve every approved ID, expectation and check mapping');
  }
  await assertWorkflowCriteria(root, state);
  const firstRunPath = state.verification_receipt;
  if (!firstRunPath) throw new FoundryError('Verification receipt is missing before workflow evidence recording');
  const receiptDocument = await readBoundedText(root, firstRunPath);
  let receipt: JsonRecord;
  try {
    const parsed = JSON.parse(receiptDocument.text) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object');
    receipt = parsed as JsonRecord;
  } catch (error) {
    throw new FoundryError('Verification receipt is malformed', { cause: error });
  }
  const receipts = Array.isArray(receipt.checks) ? receipt.checks : [];
  for (const criterion of criteria) {
    const frozen = state.workflow_criteria.find((item) => item.id === criterion.id);
    const matching = receipts.filter((item): item is JsonRecord => typeof item === 'object' && item !== null
      && !Array.isArray(item) && JSON.stringify(item.command) === JSON.stringify(criterion.command)
      && item.required === true && item.name === frozen?.check_name);
    if (matching.length !== 1) {
      throw new FoundryError(`Required criterion ${criterion.id} must map to exactly one required configured check`);
    }
    const check = matching[0];
    if (!check) throw new FoundryError(`Required criterion ${criterion.id} has no configured check`);
    await workflowRecord(root, {
      id: `factory-evidence-${String(criterion.id).toLowerCase()}-${randomUUID().slice(0, 12)}`,
      kind: 'evidence',
      title: `Factory verification for ${criterion.id}`,
      source: { kind: 'local', ref: firstRunPath, observed_at: now() },
      basis: 'observed',
      status: 'accepted',
      claim: criterion.expected,
      artifact: firstRunPath,
      method: 'command',
      outcome: 'pass',
      observed: `Required configured check ${String(check.name)} passed with exit code 0`,
      criteria: [criterion.id],
      check: check.name,
      inputs: [PLAN],
    });
  }
  await assertWorkflowCriteria(root, state);
  const gateResult = await workflowGate(root, 'verify');
  if (gateResult.status !== 'pass') throw new FoundryError('Workflow verification gate remains unverified');
}

async function executeBuild(root: string, state: FactoryState): Promise<void> {
  if (!state.approvals.plan || !state.approvals.design) throw new FoundryError('Build requires current Plan and Design approvals');
  if (!(await configuredChecks(root)).some((check) => check.required)) {
    throw new FoundryError('Build requires at least one real configured required check');
  }
  if (!state.build_tasks.length) {
    if (!(await exists(root, TASKS))) {
      await runProvider(root, state, 'build',
        `Create ${TASKS} with 1 to 12 small unchecked Markdown tasks derived from the approved Plan and Design. Do not implement product code in this planning turn.`,
        false,
        await captureUpstream(root, 'build', true));
    }
    const titles = await parseTasks(root);
    state.build_tasks = titles.map((title) => ({
      title, status: 'pending' as const, repair_attempts: 0, checkpoint: null,
    }));
    state.documents.tasks = await digestDocument(root, TASKS);
    await save(root, state);
  }
  for (const task of state.build_tasks) {
    if (task.status === 'done') continue;
    if (cancellationRequested(root)) throw new FoundryError('Factory cancellation requested');
    task.status = 'working';
    await save(root, state);
    let passed = false;
    for (;;) {
      const captured = await captureUpstream(root, 'build');
      const prompt = task.repair_attempts
        ? `Repair task "${task.title}" (repair ${task.repair_attempts} of 3). Inspect the latest lifecycle verification receipt and fix the product without changing required checks.`
        : `Implement only this task: "${task.title}". Keep the approved Plan and Design unchanged and preserve real required checks.`;
      await runProvider(root, state, 'build', prompt, false, captured);
      if (cancellationRequested(root)) throw new FoundryError('Factory cancellation requested');
      const verificationCode = await lifecycleVerify(root, () => cancellationRequested(root));
      const [receiptPath, lifecycleState] = await activeRun(root);
      state.verification_receipt = lifecycleState?.verification ?? receiptPath;
      if (verificationCode === 130) throw new FoundryError('Factory cancellation requested');
      if (verificationCode === 0) {
        await assertWorkflowCriteria(root, state);
        passed = true;
        break;
      }
      if (task.repair_attempts >= 3) break;
      task.repair_attempts += 1;
      await save(root, state);
    }
    if (!passed) {
      task.status = 'failed';
      state.status = 'failed';
      state.failure = safeFailure('build', 'check');
      await save(root, state);
      throw new FoundryError('Required checks still fail after three bounded repairs');
    }
    await tickTask(root, task.title);
    task.status = 'done';
    task.checkpoint = checkpoint(root, `Foundry build task: ${task.title}`);
    state.documents.tasks = await digestDocument(root, TASKS);
    await save(root, state);
  }
  addCompleted(state, 'build');
  state.stage = 'verify';
  state.status = 'ready';
  state.provider_task_id = null;
  state.provider_stage = null;
  await save(root, state);
}

async function executeReview(root: string, state: FactoryState): Promise<void> {
  if (!state.approvals.plan || !state.approvals.design || !state.lifecycle_run_id) {
    throw new FoundryError('Test requires current Plan and Design approvals');
  }
  const firstCode = await lifecycleVerify(root, () => cancellationRequested(root));
  const [, firstLifecycle] = await activeRun(root);
  state.verification_receipt = firstLifecycle?.verification ?? null;
  await save(root, state);
  if (firstCode === 130) throw new FoundryError('Factory cancellation requested');
  if (firstCode !== 0) {
    state.status = 'failed';
    state.failure = safeFailure('verify', 'check');
    await save(root, state);
    throw new FoundryError('Required checks failed before reviewer execution');
  }
  await markTaskEvidence(root, state);
  const finalCode = await lifecycleVerify(root, () => cancellationRequested(root));
  const [, finalLifecycle] = await activeRun(root);
  state.verification_receipt = finalLifecycle?.verification ?? null;
  await save(root, state);
  if (finalCode === 130) throw new FoundryError('Factory cancellation requested');
  if (finalCode !== 0 || !state.verification_receipt) {
    state.status = 'failed';
    state.failure = safeFailure('verify', 'check');
    await save(root, state);
    throw new FoundryError('Final verification did not pass');
  }
  const revision = await workspaceRevision(root);
  const receiptDocument = await readBoundedText(root, state.verification_receipt);
  let receipt: JsonRecord;
  try {
    const parsed = JSON.parse(receiptDocument.text) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object');
    receipt = parsed as JsonRecord;
  } catch (error) {
    throw new FoundryError('Final verification receipt is malformed', { cause: error });
  }
  const receiptSummary = {
    run_id: receipt.run_id,
    passed: receipt.passed,
    inputs_before: receipt.inputs_before,
    inputs_after: receipt.inputs_after,
    checks: Array.isArray(receipt.checks) ? receipt.checks.map((check) => {
      if (typeof check !== 'object' || check === null || Array.isArray(check)) return null;
      const item = check as JsonRecord;
      return {
        name: item.name,
        required: item.required,
        status: item.status,
        exit_code: item.exit_code,
        log: item.log,
      };
    }) : [],
  };
  if (Buffer.byteLength(JSON.stringify(receiptSummary)) > 64 * 1024) {
    throw new FoundryError('Final verification receipt summary exceeds 64 KiB');
  }
  const prompt = [
    'Return one strict JSON object matching the installed review contract.',
    `Plan revision: ${state.approvals.plan.revision}`,
    `Tested workspace revision: ${revision}`,
    'Approved criteria:',
    JSON.stringify(state.approvals.plan.criteria),
    `Final verification receipt: ${state.verification_receipt}`,
    `Final verification receipt summary: ${JSON.stringify(receiptSummary)}`,
    'Use project-relative evidence paths from the receipt and its check logs, hash their actual bytes, mark every criterion pass only when evidence supports it, and include no blockers.',
  ].join('\n');
  const result = await runProvider(root, state, 'verify', prompt, true, await captureUpstream(root, 'verify'));
  if (resultStatus(result) !== 'completed') throw new FoundryError('Reviewer provider did not complete');
  const parsed = outputFromResult(result);
  const evidence = await reviewEvidenceDigests(root, parsed);
  const evidenceAfterReview = await reviewEvidenceDigests(root, parsed);
  if (JSON.stringify(evidenceAfterReview.entries) !== JSON.stringify(evidence.entries)) {
    throw new FoundryError('Reviewer evidence changed during Test review');
  }
  const validated = validateReview(parsed, {
    plan_revision: state.approvals.plan.revision,
    workspace_revision: revision,
    criteria: state.approvals.plan.criteria,
  }, evidenceAfterReview.digests);
  const afterReview = await workspaceRevision(root);
  if (afterReview !== revision) throw new FoundryError('Reviewer changed the workspace after Test verification');
  state.review = {
    provider_task_id: resultTaskId(result),
    provider_status: 'completed',
    receipt_path: state.verification_receipt,
    plan_revision: state.approvals.plan.revision,
    workspace_revision: revision,
    reviewed_at: now(),
    evidence: evidenceAfterReview.entries,
    result: validated,
  };
  addCompleted(state, 'verify');
  state.stage = 'release';
  state.status = 'reviewed';
  state.provider_task_id = null;
  state.provider_stage = null;
  state.failure = null;
  await save(root, state);
}

async function executeShip(root: string, state: FactoryState): Promise<void> {
  if (!state.review || !state.verification_receipt || !state.lifecycle_run_id) {
    throw new FoundryError('Ship requires a validated Test review');
  }
  const revision = await workspaceRevision(root);
  await assertFactoryShipGate(root, state.lifecycle_run_id, state.verification_receipt, revision, true);
  const summary = [
    `# ${state.name} Ship summary`,
    '',
    `Tested workspace revision: ${revision}`,
    `Approved Plan revision: ${state.approvals.plan?.revision ?? 'unknown'}`,
    `Review criteria: ${state.review.result.criteria.length} passed`,
    `Verification receipt: ${state.verification_receipt}`,
    '',
    'Publication: not_authorized',
  ].join('\n');
  const shipPayload = factoryShipSchema.parse({
    schema_version: 1,
    run_id: state.lifecycle_run_id,
    created_at: now(),
    plan_revision: state.approvals.plan?.revision,
    workspace_revision: revision,
    verification_receipt: state.verification_receipt,
    review_sha256: digest(JSON.stringify(state.review.result)),
    summary,
    publication: 'not_authorized',
  });
  const shipPath = '.foundry/state/factory/ship.json';
  await atomicJson(root, shipPath, shipPayload);
  state.ship = { path: shipPath, sha256: digest(Buffer.from(`${JSON.stringify(shipPayload, null, 2)}\n`)) };
  state.status = 'shipping';
  await save(root, state);
  await assertFactoryShipGate(root, state.lifecycle_run_id, state.verification_receipt, revision);
  const completionCode = await lifecycleComplete(root);
  if (completionCode !== 0) throw new FoundryError('Lifecycle completion did not pass the Factory Ship gate');
  state.status = 'completed';
  addCompleted(state, 'release');
  state.stage = 'release';
  state.provider_task_id = null;
  state.provider_stage = null;
  state.failure = null;
  await save(root, state);
}

function roleOptions(values: string[] | undefined, defaults: FactoryState['roles']): FactoryState['roles'] {
  const roles = { ...defaults };
  for (const value of values ?? []) {
    const [stage, name, ...extra] = value.split('=');
    if (extra.length || !stage || !name || !FACTORY_STAGES.includes(stage as FactoryStage)) {
      throw new FoundryError('Roles must use --role STAGE=ROLE for a known factory stage');
    }
    roles[stage as FactoryStage] = name;
  }
  return roles;
}

export interface FactoryInitOptions {
  name: string;
  idea: string;
  adapter: string;
  model?: string;
  reasoning?: string;
  billing?: 'local' | 'subscription';
  confirmed?: boolean;
  roles?: string[];
}

export interface FactoryConfigureOptions {
  adapter?: string;
  model?: string;
  reasoning?: string;
  billing?: 'local' | 'subscription';
  confirmed?: boolean;
  roles?: string[];
}

export async function initFactory(rootInput: string, options: FactoryInitOptions): Promise<FactoryState> {
  const root = await requireController(rootInput, 'initialize the TypeScript factory');
  if (!options.name.trim() || options.name.length > 120 || /[\r\n]/.test(options.name)) {
    throw new FoundryError('Factory name must be a single line of 1 to 120 characters');
  }
  if (!options.idea.trim() || Buffer.byteLength(options.idea, 'utf8') > 64 * 1024) {
    throw new FoundryError('Factory idea must be nonempty and at most 64 KiB');
  }
  if (options.billing && !['local', 'subscription'].includes(options.billing)) {
    throw new FoundryError('Factory billing must be local or subscription');
  }
  const roles = roleOptions(options.roles, DEFAULT_ROLES);
  const billing = {
    mode: options.billing ?? 'local',
    confirmed: options.billing === 'subscription' ? options.confirmed === true : false,
  } as FactoryState['billing'];
  await selectedRoles(root, roles);
  await selectedAdapter(root, options.adapter, options.model ?? null, options.reasoning ?? null, billing);
  return withProcessLock(within(root, FACTORY_LOCK), async () => {
    if (await exists(root, FACTORY_STATE)) throw new FoundryError('Factory is already initialized');
    if (await exists(root, IDEA)) throw new FoundryError('The existing idea document is preserved; factory init will not overwrite it');
    const ideaText = `# ${options.name.trim()}\n\n${options.idea.trim()}\n`;
    await atomicWrite(root, IDEA, ideaText);
    const state: FactoryState = {
      schema_version: 1,
      workspace_id: randomUUID(),
      created_at: now(),
      updated_at: now(),
      name: options.name.trim(),
      status: 'ready',
      stage: 'research',
      completed_stages: [],
      adapter: options.adapter,
      kind: 'agent-runtime',
      model: options.model?.trim() || null,
      reasoning: options.reasoning?.trim() || null,
      billing,
      roles,
      lifecycle_run_id: null,
      provider_task_id: null,
      provider_stage: null,
      approvals: { plan: null, design: null },
      documents: { idea: digest(Buffer.from(ideaText)), research: null, plan: null, design: null, tasks: null },
      workflow_criteria: [],
      build_tasks: [],
      verification_receipt: null,
      review: null,
      ship: null,
      failure: null,
    };
    await save(root, state);
    return state;
  });
}

export async function configureFactory(rootInput: string, options: FactoryConfigureOptions): Promise<FactoryState> {
  const root = await requireController(rootInput, 'configure the TypeScript factory');
  if (options.billing && !['local', 'subscription'].includes(options.billing)) {
    throw new FoundryError('Factory billing must be local or subscription');
  }
  return withProcessLock(within(root, FACTORY_LOCK), async () => {
    const state = await load(root);
    if (state.status === 'running' || state.status === 'shipping') {
      throw new FoundryError('Factory configuration cannot change during a running stage');
    }
    if (state.provider_task_id) throw new FoundryError('Reconcile the active provider task before changing factory settings');
    const adapter = options.adapter ?? state.adapter;
    const model = options.model === undefined ? state.model : (options.model.trim() || null);
    const reasoning = options.reasoning === undefined ? state.reasoning : (options.reasoning.trim() || null);
    const roles = roleOptions(options.roles, state.roles);
    const adapterChanged = adapter !== state.adapter;
    const billing = options.billing
      ? {
        mode: options.billing,
        confirmed: options.billing === 'subscription' ? options.confirmed === true : false,
      }
      : adapterChanged ? { mode: 'local' as const, confirmed: false } : state.billing;
    await selectedRoles(root, roles);
    await selectedAdapter(root, adapter, model, reasoning, billing);
    const settingsChanged = adapter !== state.adapter || model !== state.model || reasoning !== state.reasoning
      || JSON.stringify(roles) !== JSON.stringify(state.roles)
      || JSON.stringify(billing) !== JSON.stringify(state.billing);
    state.adapter = adapter;
    state.model = model;
    state.reasoning = reasoning;
    state.billing = billing;
    state.roles = roles;
    if (settingsChanged && FACTORY_STAGES.indexOf(state.stage) >= FACTORY_STAGES.indexOf('verify')) {
      state.stage = 'verify';
      state.completed_stages = state.completed_stages.filter((stage) => stage !== 'verify' && stage !== 'release');
      state.verification_receipt = null;
      state.review = null;
      state.ship = null;
      state.status = 'ready';
    }
    state.failure = null;
    await save(root, state);
    return state;
  });
}

function nextAction(state: FactoryState): { action: string; stage: FactoryStage | null; label: string | null } {
  if (state.status === 'completed') return { action: 'none', stage: null, label: null };
  if (state.status === 'awaiting_approval') return {
    action: 'approve',
    stage: state.stage,
    label: FACTORY_STAGE_LABELS[state.stage],
  };
  if (state.status === 'interrupted' || state.status === 'recovery_required') return {
    action: 'recover',
    stage: state.stage,
    label: FACTORY_STAGE_LABELS[state.stage],
  };
  return {
    action: state.status === 'failed' ? 'rerun' : 'run',
    stage: state.stage,
    label: FACTORY_STAGE_LABELS[state.stage],
  };
}

export async function statusFactory(rootInput: string): Promise<JsonRecord> {
  const root = await requireController(rootInput, 'inspect the TypeScript factory');
  const state = await load(root);
  const current = await documentDigests(root);
  const stale = (Object.keys(current) as Array<keyof FactoryState['documents']>)
    .filter((key) => state.documents[key] !== current[key]);
  const stalePlan = Boolean(state.approvals.plan && current.plan !== state.approvals.plan.revision);
  const staleDesign = Boolean(state.approvals.design && current.design !== state.approvals.design.revision);
  return {
    ...state,
    ready_next_step: stalePlan
      ? { action: 'approve', stage: 'scope', label: 'Plan' }
      : staleDesign
        ? { action: 'approve', stage: 'design', label: 'Design' }
        : nextAction(state),
    completed_work: state.completed_stages.map((stage) => ({ stage, label: FACTORY_STAGE_LABELS[stage] })),
    stale_inputs: stale,
    stale_approvals: [
      ...(state.approvals.plan && current.plan !== state.approvals.plan.revision ? ['plan'] : []),
      ...(state.approvals.design && current.design !== state.approvals.design.revision ? ['design'] : []),
    ],
  };
}

export async function reviewFactory(rootInput: string, stageInput?: 'plan' | 'design'): Promise<JsonRecord> {
  const root = await requireController(rootInput, 'review a TypeScript factory document');
  const state = await load(root);
  const stage = stageInput ?? (state.stage === 'design' ? 'design' : 'plan');
  const relative = stage === 'plan' ? PLAN : DESIGN;
  const file = await readBoundedText(root, relative);
  return {
    stage,
    label: stage === 'plan' ? 'Plan' : 'Design',
    path: relative,
    revision: digest(file.bytes),
    criteria: stage === 'plan' ? approvedCriteria(file.text) : [],
    text: file.text,
  };
}

export async function approveFactory(rootInput: string, stage: 'plan' | 'design', revision: string): Promise<FactoryState> {
  const root = await requireController(rootInput, 'approve a TypeScript factory document');
  if (!/^[a-f0-9]{64}$/.test(revision)) throw new FoundryError('Approval revision must be a SHA-256 digest');
  return withProcessLock(within(root, FACTORY_LOCK), async () => {
    const state = await load(root);
    if (await reconcileDocuments(root, state)) await save(root, state);
    const expectedStage = stage === 'plan' ? 'scope' : 'design';
    if (state.stage !== expectedStage || state.status !== 'awaiting_approval') {
      throw new FoundryError(`Factory is not awaiting ${stage === 'plan' ? 'Plan' : 'Design'} approval`);
    }
    const relative = stage === 'plan' ? PLAN : DESIGN;
    const file = await readBoundedText(root, relative);
    const currentRevision = digest(file.bytes);
    if (currentRevision !== revision) throw new FoundryError('The reviewed document changed; reopen factory review before approving');
    const approval = {
      revision,
      approved_at: now(),
      criteria: stage === 'plan' ? approvedCriteria(file.text) : [],
    };
    const [, lifecycle] = await activeRun(root);
    if (lifecycle && state.lifecycle_run_id !== lifecycle.run_id) {
      if (state.lifecycle_run_id || lifecycle.slug !== slug(state.name) || lifecycle.spec !== PLAN) {
        throw new FoundryError('An unrelated lifecycle run is active; factory approval cannot take ownership of it');
      }
    }
    if (lifecycle && lifecycle.status !== 'building') {
      await lifecyclePauseOrResume(root, false);
    }
    if (!lifecycle) {
      const started = await lifecycleStart(root, slug(state.name), PLAN);
      state.lifecycle_run_id = started.run_id;
    } else {
      state.lifecycle_run_id = lifecycle.run_id;
    }
    if (stage === 'plan') {
      state.approvals.plan = approval;
      state.documents.plan = currentRevision;
      state.stage = 'design';
      addCompleted(state, 'scope');
    } else {
      state.approvals.design = approval;
      state.documents.design = currentRevision;
      state.stage = 'build';
      addCompleted(state, 'design');
    }
    state.status = 'ready';
    state.build_tasks = [];
    state.documents.tasks = null;
    state.verification_receipt = null;
    state.review = null;
    state.ship = null;
    state.failure = null;
    await save(root, state);
    return state;
  });
}

export async function runFactory(rootInput: string): Promise<FactoryState> {
  const root = await requireController(rootInput, 'run the TypeScript factory');
  return withProcessLock(within(root, FACTORY_LOCK), async () => {
    const state = await load(root);
    if (await reconcileDocuments(root, state)) await save(root, state);
    if (state.status === 'completed') return state;
    if (state.status === 'awaiting_approval') throw new FoundryError('Owner approval is required before this factory stage');
    if (state.status === 'interrupted' || state.status === 'recovery_required') {
      if (state.status === 'recovery_required' || state.provider_task_id) {
        throw new FoundryError('Recover the interrupted factory stage before starting new work');
      }
    }
    if (state.status === 'shipping') throw new FoundryError('Recover the in-progress Ship stage before retrying');
    if (state.provider_task_id) throw new FoundryError('Reconcile the previous provider task before starting new work');
    await clearCancellation(root);
    if (['failed', 'interrupted'].includes(state.status) && state.stage === 'build') {
      for (const task of state.build_tasks) {
        if (task.status === 'failed') {
          task.status = 'pending';
          task.repair_attempts = 0;
        }
      }
    }
    state.status = 'running';
    state.failure = null;
    await save(root, state);
    try {
      if (state.stage === 'research') {
        await runProvider(root, state, 'research',
          `Write ${RESEARCH} as bounded UTF-8 Markdown research grounded in inspectable local or HTTPS sources. If a capability is unavailable, say so explicitly.`);
        const artifact = await readBoundedText(root, RESEARCH);
        if (!artifact.text.trim() || (!artifact.text.includes('https://') && !/unavailable|unknown/i.test(artifact.text))) {
          throw new FoundryError('Research needs inspectable source URLs or an explicit unavailable statement');
        }
        state.documents.research = digest(artifact.bytes);
        addCompleted(state, 'research');
        state.stage = 'scope';
        state.status = 'ready';
        state.provider_task_id = null;
        state.provider_stage = null;
        await save(root, state);
      } else if (state.stage === 'scope') {
        await runProvider(root, state, 'scope',
          `Write ${PLAN} as the bounded product plan. Include exactly one "## Acceptance criteria" section with one or more observable lines in the form "- [AC-001] expectation". Do not use another acceptance heading.`);
        const artifact = await readBoundedText(root, PLAN);
        approvedCriteria(artifact.text);
        state.documents.plan = digest(artifact.bytes);
        state.status = 'awaiting_approval';
        state.provider_task_id = null;
        state.provider_stage = null;
        await save(root, state);
      } else if (state.stage === 'design') {
        await runProvider(root, state, 'design',
          `Write ${DESIGN} as a concrete design handoff from the approved Plan, including primary and failure states, responsive behavior and implementation guidance.`);
        const artifact = await readBoundedText(root, DESIGN);
        if (!artifact.text.trim()) throw new FoundryError('Design artifact must be nonempty');
        state.documents.design = digest(artifact.bytes);
        state.status = 'awaiting_approval';
        state.provider_task_id = null;
        state.provider_stage = null;
        await save(root, state);
      } else if (state.stage === 'build') {
        await executeBuild(root, state);
      } else if (state.stage === 'verify') {
        await executeReview(root, state);
      } else {
        await executeShip(root, state);
      }
      return state;
    } catch (error) {
      const current = await readFactoryState(root) ?? state;
      const canceled = cancellationRequested(root) || /cancel/i.test((error as Error).message);
      if (current.status !== 'completed') {
        current.status = current.status === 'recovery_required' ? 'recovery_required' : canceled ? 'interrupted' : 'failed';
        current.failure = safeFailure(current.stage, canceled ? 'canceled' : current.stage === 'verify' ? 'review' : current.stage === 'build' ? 'check' : 'artifact');
        await save(root, current);
      }
      throw error;
    }
  });
}

export async function cancelFactory(rootInput: string): Promise<JsonRecord> {
  const root = await requireController(rootInput, 'cancel the TypeScript factory');
  return withProcessLock(within(root, FACTORY_CANCEL_LOCK), async () => {
    const state = await load(root);
    if (state.status !== 'running') throw new FoundryError('Factory has no running stage to cancel');
    const payload = {
      schema_version: 1,
      requested_at: now(),
      workspace_id: state.workspace_id,
      provider_task_id: state.provider_task_id,
    };
    await atomicJson(root, FACTORY_CANCEL, payload);
    if (state.provider_task_id) {
      try {
        await cancelProvider(root, state.provider_task_id);
      } catch {
        // The runner will reconcile this provider task under the factory lease.
      }
    }
    return { requested: true, provider_task_id: state.provider_task_id };
  });
}

async function completedLifecycleMatches(root: string, state: FactoryState): Promise<boolean> {
  if (!state.lifecycle_run_id || !state.review || !state.verification_receipt || !state.ship) return false;
  const lastPath = '.foundry/state/last-completed.json';
  if (!(await exists(root, lastPath))) return false;
  try {
    const pointer = JSON.parse((await readBoundedText(root, lastPath)).text) as JsonRecord;
    if (pointer.run_id !== state.lifecycle_run_id || typeof pointer.state !== 'string') return false;
    const lifecycle = JSON.parse((await readBoundedText(root, pointer.state)).text) as JsonRecord;
    return lifecycle.run_id === state.lifecycle_run_id
      && lifecycle.status === 'completed'
      && lifecycle.verification === state.verification_receipt;
  } catch {
    return false;
  }
}

export async function recoverFactory(rootInput: string): Promise<FactoryState> {
  const root = await requireController(rootInput, 'recover the TypeScript factory');
  return withProcessLock(within(root, FACTORY_LOCK), async () => {
    const state = await load(root);
    if (state.status === 'completed') return state;
    if (state.provider_task_id) {
      let provider: JsonRecord;
      try {
        provider = await readProviderStatus(root, state.provider_task_id);
      } catch {
        state.status = 'recovery_required';
        state.failure = safeFailure(state.stage, 'recovery');
        await save(root, state);
        return state;
      }
      const providerState = resultStatus(provider);
      if (['running', 'unknown'].includes(providerState)) {
        try {
          await reconcileProvider(root, state.provider_task_id, false);
          provider = await readProviderStatus(root, state.provider_task_id);
        } catch {
          // Keep the task ID and recovery-required state on an unresolved process.
        }
      }
      const reconciledStatus = resultStatus(provider);
      if (['running', 'unknown'].includes(reconciledStatus)) {
        state.status = 'recovery_required';
        state.failure = safeFailure(state.stage, 'recovery');
        await save(root, state);
        return state;
      }
      // A terminal provider task is not an integration receipt. It remains interrupted
      // until an owner explicitly reruns the stage.
      state.provider_task_id = null;
      state.provider_stage = null;
      state.status = 'interrupted';
      state.failure = safeFailure(state.stage, 'recovery');
      await save(root, state);
      await clearCancellation(root);
      return state;
    }
    const [, lifecycle] = await activeRun(root);
    if (lifecycle) {
      try {
        await lifecycleRecover(root);
      } catch {
        // Preserve a durable recovery-required controller state below.
      }
      state.status = 'interrupted';
      state.failure = safeFailure(state.stage, 'recovery');
      await save(root, state);
      await clearCancellation(root);
      return state;
    }
    await clearCancellation(root);
    if (await completedLifecycleMatches(root, state)) {
      const revision = state.review?.workspace_revision;
      if (revision && await workspaceRevision(root) === revision) {
        try {
          await assertFactoryShipGate(root, state.lifecycle_run_id as string, state.verification_receipt as string, revision);
          state.status = 'completed';
          addCompleted(state, 'release');
          await save(root, state);
          await clearCancellation(root);
          return state;
        } catch {
          // A lifecycle completion without a valid matching controller review stays unresolved.
        }
      }
    }
    state.status = 'recovery_required';
    state.failure = safeFailure(state.stage, 'recovery');
    await save(root, state);
    return state;
  });
}

export function factoryHelp(): string {
  return [
    'factory init --name NAME --idea TEXT --adapter NAME [--model MODEL] [--reasoning LEVEL]',
    'factory configure [--adapter NAME] [--model MODEL] [--reasoning LEVEL] [--billing local|subscription] [--confirmed]',
    'factory status',
    'factory run',
    'factory review [--stage plan|design]',
    'factory approve --stage plan|design --revision SHA256',
    'factory cancel',
    'factory recover',
  ].join('\n');
}
