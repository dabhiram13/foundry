import { existsSync } from 'node:fs';
import { appendFile, readFile, readdir, rm } from 'node:fs/promises';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import type { Readable } from 'node:stream';
import { z } from 'zod';
import {
  atomicJson, atomicWrite, canonicalJson, digest, exists, findProjectRoot, FoundryError, now,
  readJson, within, withProcessLock,
} from '../core/fs.js';
import { readBoundedBytes } from '../core/factory-contract.js';
import { requireRuntimeWorkspace } from '../core/lifecycle.js';
import { providerEnvironment } from './environment.js';

const CAPABILITIES = ['jsonl', 'structured_output', 'resume', 'cancel', 'permissions', 'tools', 'browser', 'model_selection', 'reasoning_selection'] as const;
const BILLING_MODES = ['subscription', 'api', 'local'] as const;
const adapterSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
  kind: z.enum(['agent-runtime', 'bounded-model']),
  command: z.array(z.string().min(1).refine((part) => !part.includes('\0'))).min(1),
  capabilities: z.array(z.enum(CAPABILITIES)).min(1),
  billing_modes: z.array(z.enum(BILLING_MODES)).min(1),
  environment: z.array(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/)).max(64)
    .refine(names => new Set(names).size === names.length, 'Environment names must be unique').optional(),
}).strict();
const requestSchema = z.object({
  adapter: z.string().min(1).default('codex'),
  kind: z.string().optional(),
  prompt: z.string().min(1).refine((prompt) => prompt.trim().length > 0),
  required_capabilities: z.array(z.string()).default([]),
  model: z.string().min(1).nullable().optional(),
  reasoning: z.string().min(1).nullable().optional(),
  permissions: z.record(z.string(), z.unknown()).optional(),
  output_schema: z.record(z.string(), z.unknown()).optional(),
  billing: z.object({
    mode: z.enum(BILLING_MODES),
    confirmed: z.boolean().optional(),
    allow_api: z.boolean().optional(),
    acknowledge_posthoc_cost: z.boolean().optional(),
    reservation_dollars: z.number().nonnegative().optional(),
  }).passthrough().default({ mode: 'local' }),
  budget: z.object({
    max_attempts: z.number().int().positive().default(1),
    max_concurrency: z.number().int().positive().default(1),
    max_elapsed_seconds: z.number().positive().default(300),
    max_api_dollars: z.number().nonnegative().default(0),
  }).passthrough().default({ max_attempts: 1, max_concurrency: 1, max_elapsed_seconds: 300, max_api_dollars: 0 }),
}).passthrough();

export type ProviderAdapter = z.infer<typeof adapterSchema> & {
  protocol: string;
  unsupported?: string;
};

const TASK_STATUSES = [
  'ready', 'running', 'completed', 'failed', 'unavailable', 'timed_out', 'canceled',
  'interrupted', 'unknown', 'budget_exceeded', 'billing_violation',
] as const;
const ATTEMPT_STATUSES = [...TASK_STATUSES] as const;

const attemptUsageSchema = z.object({
  input_tokens: z.number().int().nonnegative().nullable(),
  output_tokens: z.number().int().nonnegative().nullable(),
  api_dollars: z.number().nonnegative().nullable(),
}).strict();

const savedAttemptSchema = z.object({
  number: z.number().int().positive(),
  started_at: z.string().min(1),
  status: z.enum(ATTEMPT_STATUSES),
  prompt_digest: z.string().regex(/^[0-9a-f]{64}$/),
  terminal_count: z.number().int().nonnegative(),
  requested_model: z.string().min(1).nullable().optional(),
  resolved_model: z.string().min(1).nullable().optional(),
  usage: attemptUsageSchema,
  api_reservation_dollars: z.number().nonnegative(),
  side_effects: z.literal('not_verified'),
  pid: z.number().int().positive().optional(),
  command_digest: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  executable: z.string().min(1).optional(),
  evidence: z.string().min(1).optional(),
  error: z.object({ code: z.string().min(1), message: z.string() }).strict().optional(),
  output: z.unknown().optional(),
  terminal_status: z.string().min(1).optional(),
  usage_source: z.string().min(1).optional(),
  finished_at: z.string().min(1).optional(),
  returncode: z.number().int().nullable().optional(),
  elapsed_seconds: z.number().nonnegative().optional(),
  reconciliation: z.object({
    at: z.string().min(1),
    owner_confirmed_stopped_and_effects_checked: z.boolean(),
  }).strict().optional(),
}).strict();

const savedSettingsSchema = z.object({
  adapter: z.string().min(1),
  adapter_digest: z.string().regex(/^[0-9a-f]{64}$/),
  kind: z.enum(['agent-runtime', 'bounded-model']),
  required_capabilities: z.array(z.enum(CAPABILITIES)).min(1).refine((items) => new Set(items).size === items.length),
  model: z.string().min(1).nullable(),
  reasoning: z.string().min(1).nullable(),
  permissions: z.object({ sandbox: z.enum(['read-only', 'workspace-write']) }).strict().nullable(),
  output_schema_digest: z.string().regex(/^[0-9a-f]{64}$/),
  billing: z.object({
    mode: z.enum(BILLING_MODES),
    confirmed: z.boolean().optional(),
    allow_api: z.boolean().optional(),
    acknowledge_posthoc_cost: z.boolean().optional(),
    reservation_dollars: z.number().nonnegative().optional(),
  }).strict(),
  budget: z.object({
    max_attempts: z.number().int().positive(),
    max_concurrency: z.number().int().positive(),
    max_elapsed_seconds: z.number().positive(),
    max_api_dollars: z.number().nonnegative(),
  }).strict(),
}).strict();

const savedTaskSchema = z.object({
  schema_version: z.literal(1),
  adapter_contract_version: z.literal(1),
  task_id: z.string().uuid(),
  created_at: z.string().min(1),
  status: z.enum(TASK_STATUSES),
  session_id: z.string().min(1).nullable(),
  settings: savedSettingsSchema,
  attempts: z.array(savedAttemptSchema),
  elapsed_seconds: z.number().nonnegative(),
  usage: z.object({
    input_tokens: z.number().int().nonnegative().nullable(),
    output_tokens: z.number().int().nonnegative().nullable(),
    api_dollars: z.number().nonnegative().nullable(),
    known_api_dollars: z.number().nonnegative(),
    subscription_allowance_remaining: z.number().nonnegative().nullable(),
  }).strict(),
  updated_at: z.string().min(1).optional(),
  requested_model: z.string().min(1).nullable().optional(),
  resolved_model: z.string().min(1).nullable().optional(),
  billing_assurance: z.string().min(1).optional(),
}).strict();

export type ProviderRequest = z.infer<typeof requestSchema>;
export type SavedTaskStatus = typeof TASK_STATUSES[number];

export function savedTaskStatus(value: unknown): SavedTaskStatus {
  return savedTaskSchema.parse(value).status;
}

type JsonRecord = Record<string, unknown>;
export interface ExecuteOptions {
  onStarted?: (taskId: string) => Promise<void> | void;
}

const STATE = '.foundry/state/providers';
const MAX_INPUT = 256 * 1024;
const MAX_LINE = 256 * 1024;
const MAX_OUTPUT = 2 * 1024 * 1024;

function codexExecutable(): string {
  if (process.env.FOUNDRY_CODEX) return process.env.FOUNDRY_CODEX;
  const desktop = '/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex';
  return process.platform === 'darwin' && existsSync(desktop) ? desktop : 'codex';
}

function builtinRegistry(): Record<string, ProviderAdapter> {
  const capabilities = [...CAPABILITIES].filter((value) => value !== 'browser');
  return {
    codex: {
      name: 'codex', kind: 'agent-runtime', command: [codexExecutable()],
      protocol: 'codex-jsonl', billing_modes: ['subscription', 'api'], capabilities,
    },
    chatgpt: {
      name: 'chatgpt', kind: 'agent-runtime', command: [],
      protocol: 'marketcraft-jsonl-v1', billing_modes: ['subscription'],
      capabilities: capabilities.filter((value) => value !== 'structured_output'),
      unsupported: 'ChatGPT execution is unsupported by this runtime; configure a supported provider adapter instead.',
    },
  };
}

export async function registry(root: string, sourceConfiguration?: Uint8Array | null): Promise<Record<string, ProviderAdapter>> {
  const result = builtinRegistry();
  const configPath = within(root, '.foundry/providers.json');
  if (sourceConfiguration === null
    || (sourceConfiguration === undefined && !(await exists(root, '.foundry/providers.json')))) return result;
  const bytes = sourceConfiguration ?? await readBoundedBytes(root, '.foundry/providers.json', 256 * 1024);
  let document: unknown;
  try {
    document = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    throw new FoundryError(`Cannot read JSON ${configPath}`, { cause: error });
  }
  if (typeof document !== 'object' || document === null || Array.isArray(document)
    || Object.keys(document).join(',') !== 'adapters' || !Array.isArray((document as JsonRecord).adapters)) {
    throw new FoundryError('providers.json needs an adapters list');
  }
  for (const raw of (document as JsonRecord).adapters as unknown[]) {
    const parsed = adapterSchema.safeParse(raw);
    if (!parsed.success) throw new FoundryError(`Invalid local adapter: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`);
    if (result[parsed.data.name]) throw new FoundryError('Adapter names must be unique; codex and chatgpt are reserved');
    if (parsed.data.kind === 'bounded-model'
      && parsed.data.capabilities.some((capability) => ['tools', 'browser', 'permissions', 'resume'].includes(capability))) {
      throw new FoundryError('A bounded-model adapter cannot advertise agent session/tools/permissions');
    }
    result[parsed.data.name] = { ...parsed.data, protocol: 'marketcraft-jsonl-v1' };
  }
  return result;
}

function redactor(environment: NodeJS.ProcessEnv, selectedNames: readonly string[] = []): (value: unknown) => unknown {
  const sensitiveKey = /secret|password|passwd|api[_-]?key|authorization|cookie|credential|private[_-]?key|^token$|access[_-]?token|refresh[_-]?token/i;
  const secrets = Object.entries(environment)
    .filter(([key, value]) => typeof value === 'string' && value.length > 0
      && (selectedNames.includes(key) || (sensitiveKey.test(key) && value.length >= 4)))
    .map(([, value]) => value as string)
    .sort((left, right) => right.length - left.length);
  const clean = (value: unknown, key?: string): unknown => {
    if (key && sensitiveKey.test(key)) return '[redacted]';
    if (typeof value === 'string') {
      let safe = value;
      for (const secret of secrets) safe = safe.replaceAll(secret, '[redacted]');
      return safe
        .replace(/\b(Bearer\s+)\S+/gi, '$1[redacted]')
        .replace(/\b(?:sk-(?:proj-)?|gh[pousr]_|github_pat_|AKIA)[A-Za-z0-9_-]{12,}\b/g, '[redacted]')
        .replace(/((?:api[_-]?key|password|access_token|secret)\s*[=:]\s*)[^\s,;]+/gi, '$1[redacted]');
    }
    if (Array.isArray(value)) return value.map((item) => clean(item));
    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, clean(child, childKey)]));
    }
    return value;
  };
  return (value) => clean(value);
}

function providerPath(root: string, relative: string): string {
  return within(root, `${STATE}/${relative}`);
}

function taskPath(root: string, taskId: string): string {
  if (!z.string().uuid().safeParse(taskId).success) throw new FoundryError('Invalid provider task ID');
  return providerPath(root, `tasks/${taskId}.json`);
}

async function withRegistryLock<T>(root: string, action: () => Promise<T>): Promise<T> {
  const lockPath = providerPath(root, 'registry.lock');
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      return await withProcessLock(lockPath, action);
    } catch (error) {
      if (!(error instanceof FoundryError) || error.message !== 'Another process owns this lock; retry after it finishes'
        || attempt === 9) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
  throw new FoundryError('Provider registry remained busy after bounded retries');
}

async function loadTask(root: string, taskId: string): Promise<JsonRecord> {
  const raw = await readJson<unknown>(taskPath(root, taskId));
  const parsed = savedTaskSchema.safeParse(raw);
  if (!parsed.success) {
    throw new FoundryError(`Saved provider task ${taskId} is invalid or uses an unsupported format; reconcile it before continuing.`);
  }
  const task = parsed.data as JsonRecord;
  if (task.task_id !== taskId) throw new FoundryError('Provider task identity mismatch');
  return task;
}

async function taskList(root: string): Promise<JsonRecord[]> {
  const directory = providerPath(root, 'tasks');
  if (!(await exists(root, `${STATE}/tasks`))) return [];
  const entries = (await readdir(directory)).filter((entry) => entry.endsWith('.json')).sort();
  return Promise.all(entries.map((entry) => loadTask(root, entry.slice(0, -5))));
}

function number(value: unknown, label: string, positive = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (positive && value === 0)) {
    throw new FoundryError(`${label} must be a finite ${positive ? 'positive' : 'nonnegative'} number`);
  }
  return value;
}

function validateSchema(schema: unknown, value?: unknown): void {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) throw new FoundryError('Unsupported output schema; use the documented JSON Schema subset');
  const node = schema as JsonRecord;
  const allowed = new Set(['type', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'description', 'title']);
  if (Object.keys(node).some((key) => !allowed.has(key)) || typeof node.type !== 'string'
    || !['object', 'array', 'string', 'integer', 'number', 'boolean', 'null'].includes(node.type)) {
    throw new FoundryError('Each output schema node needs one supported type');
  }
  if (node.properties !== undefined && (typeof node.properties !== 'object' || node.properties === null || Array.isArray(node.properties))) {
    throw new FoundryError('Invalid output schema properties');
  }
  for (const child of Object.values((node.properties as JsonRecord | undefined) ?? {})) validateSchema(child);
  if (node.items !== undefined) validateSchema(node.items);
  if (node.required !== undefined && (!Array.isArray(node.required) || node.required.some((item) => typeof item !== 'string'))) {
    throw new FoundryError('Invalid output schema required fields');
  }
  if (node.additionalProperties !== undefined && typeof node.additionalProperties !== 'boolean') {
    throw new FoundryError('additionalProperties must be boolean');
  }
  if (node.enum !== undefined && (!Array.isArray(node.enum) || !node.enum.length)) throw new FoundryError('Schema enum needs a nonempty list');
  if (value === undefined) return;
  const typeMatches = node.type === 'null' ? value === null
    : node.type === 'array' ? Array.isArray(value)
      : node.type === 'object' ? typeof value === 'object' && value !== null && !Array.isArray(value)
        : node.type === 'integer' ? typeof value === 'number' && Number.isInteger(value)
          : node.type === 'number' ? typeof value === 'number'
            : typeof value === node.type;
  if (!typeMatches || (node.type === 'integer' || node.type === 'number') && typeof value === 'boolean') {
    throw new FoundryError('Result does not match output schema type');
  }
  if (Array.isArray(node.enum) && !node.enum.some((member) => canonicalJson(member) === canonicalJson(value))) throw new FoundryError('Result is outside schema enum');
  if (node.type === 'object') {
    const objectValue = value as JsonRecord;
    const required = (node.required as string[] | undefined) ?? [];
    if (required.some((key) => !(key in objectValue))) throw new FoundryError('Result violates required output properties');
    const properties = (node.properties as JsonRecord | undefined) ?? {};
    if (node.additionalProperties === false && Object.keys(objectValue).some((key) => !(key in properties))) {
      throw new FoundryError('Result contains additional output properties');
    }
    for (const [key, child] of Object.entries(properties)) if (key in objectValue) validateSchema(child, objectValue[key]);
  } else if (node.type === 'array' && node.items) {
    for (const item of value as unknown[]) validateSchema(node.items, item);
  }
}

async function prepare(root: string, request: ProviderRequest): Promise<{ adapter: ProviderAdapter; settings: JsonRecord }> {
  const allowedRequest = new Set(['adapter', 'kind', 'prompt', 'required_capabilities', 'permissions', 'model', 'reasoning', 'billing', 'budget', 'output_schema']);
  if (Object.keys(request).some((key) => !allowedRequest.has(key))) throw new FoundryError('Unknown provider request fields');
  if (Buffer.byteLength(JSON.stringify(request)) > MAX_INPUT) throw new FoundryError('Provider request exceeds 256 KiB');
  const adapters = await registry(root);
  const adapter = adapters[request.adapter];
  if (!adapter) throw new FoundryError(`Unknown provider adapter: ${request.adapter}`);
  if (adapter.unsupported) throw new FoundryError(adapter.unsupported);
  if ((request.kind ?? 'agent-runtime') !== adapter.kind) throw new FoundryError('Provider kind does not match its registry declaration');
  if (request.required_capabilities.some((name) => !CAPABILITIES.includes(name as typeof CAPABILITIES[number]))) {
    throw new FoundryError('Invalid required_capabilities');
  }
  const required = new Set([...request.required_capabilities, 'jsonl', 'cancel']);
  const permissions = request.permissions ?? (adapter.name === 'codex' ? { sandbox: 'read-only' } : null);
  if (permissions) required.add('permissions');
  if (request.output_schema) required.add('structured_output');
  for (const capability of required) {
    if (!adapter.capabilities.includes(capability as typeof CAPABILITIES[number])) throw new FoundryError(`Adapter lacks required capability: ${capability}`);
  }
  if (request.model && !adapter.capabilities.includes('model_selection')) throw new FoundryError('Adapter lacks model_selection capability');
  if (request.reasoning && !adapter.capabilities.includes('reasoning_selection')) throw new FoundryError('Adapter lacks reasoning_selection capability');
  for (const [name, value] of [['model', request.model], ['reasoning', request.reasoning]] as const) {
    if (value !== undefined && value !== null && (!value.trim() || value.length > 120 || value.includes('\n'))) {
      throw new FoundryError(`Invalid ${name} preference`);
    }
  }
  if (permissions && Object.keys(permissions).some((key) => key !== 'sandbox')) {
    throw new FoundryError('Permissions require only an explicit sandbox value');
  }
  if (permissions && !['read-only', 'workspace-write'].includes(String(permissions.sandbox))) {
    throw new FoundryError('permissions.sandbox must be read-only or workspace-write');
  }
  if (request.output_schema) {
    if (!adapter.capabilities.includes('structured_output')) throw new FoundryError('Adapter lacks structured_output capability');
    validateSchema(request.output_schema);
  }
  const billing = request.billing;
  if (Object.keys(billing).some((key) => !['mode', 'confirmed', 'allow_api', 'acknowledge_posthoc_cost', 'reservation_dollars'].includes(key))) {
    throw new FoundryError('Invalid billing contract');
  }
  if (Object.keys(request.budget).some((key) => !['max_attempts', 'max_concurrency', 'max_elapsed_seconds', 'max_api_dollars'].includes(key))) {
    throw new FoundryError('Invalid budget fields');
  }
  if (!adapter.billing_modes.includes(billing.mode)) throw new FoundryError(`Adapter does not support ${billing.mode} billing`);
  if (billing.mode === 'subscription' && billing.confirmed !== true) throw new FoundryError('Subscription billing requires explicit confirmation');
  if (billing.mode === 'api' && (billing.allow_api !== true || billing.acknowledge_posthoc_cost !== true)) {
    throw new FoundryError('API billing requires explicit consent and posthoc cost acknowledgment');
  }
  if (billing.mode === 'api') {
    const reserve = number(billing.reservation_dollars, 'reservation_dollars', true);
    if (reserve > request.budget.max_api_dollars) throw new FoundryError('API reservation must fit the max_api_dollars budget');
  } else if (billing.reservation_dollars) {
    throw new FoundryError('Only API billing uses dollar reservations');
  }
  const budget = {
    max_attempts: number(request.budget.max_attempts, 'max_attempts', true),
    max_concurrency: number(request.budget.max_concurrency, 'max_concurrency', true),
    max_elapsed_seconds: number(request.budget.max_elapsed_seconds, 'max_elapsed_seconds', true),
    max_api_dollars: number(request.budget.max_api_dollars, 'max_api_dollars'),
  };
  return {
    adapter,
    settings: {
      adapter: adapter.name, adapter_digest: digest(canonicalJson(adapter)), kind: adapter.kind,
      required_capabilities: [...required].sort(),
      model: request.model ?? null, reasoning: request.reasoning ?? null,
      permissions,
      output_schema_digest: digest(canonicalJson(request.output_schema ?? null)),
      billing, budget,
    },
  };
}

function killGroup(child: ChildProcess, signal: NodeJS.Signals): void {
  try {
    if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
}

function eventFromLine(line: string): JsonRecord | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as JsonRecord : null;
  } catch {
    return null;
  }
}

function commandFor(adapter: ProviderAdapter, settings: JsonRecord, schemaPath: string | null, sessionId: string | null): string[] {
  if (adapter.name === 'codex') {
    const permissions = settings.permissions as JsonRecord;
    const command = [...adapter.command, 'exec'];
    if (sessionId) command.push('resume');
    command.push('--json');
    if (!sessionId) command.push('--color', 'never', '--sandbox', String(permissions.sandbox));
    else command.push('-c', `sandbox_mode=${JSON.stringify(permissions.sandbox)}`);
    if (typeof settings.model === 'string') command.push('--model', settings.model);
    if (typeof settings.reasoning === 'string') command.push('-c', `model_reasoning_effort=${JSON.stringify(settings.reasoning)}`);
    if (schemaPath) command.push('--output-schema', schemaPath);
    if (sessionId) command.push(sessionId);
    command.push('-');
    return command;
  }
  return adapter.command;
}

async function processTask(root: string, adapter: ProviderAdapter, settings: JsonRecord, request: ProviderRequest, task: JsonRecord, attempt: JsonRecord): Promise<string> {
  const taskId = String(task.task_id);
  const attemptNumber = Number(attempt.number);
  const directory = `${STATE}/evidence/${taskId}/${attemptNumber}`;
  await atomicWrite(root, `${directory}/events.jsonl`, '');
  const logPath = within(root, `${directory}/events.jsonl`);
  let schemaPath: string | null = null;
  if (request.output_schema) {
    schemaPath = `${directory}/schema.json`;
    await atomicJson(root, schemaPath, request.output_schema);
  }
  const command = commandFor(adapter, settings, schemaPath ? within(root, schemaPath) : null, typeof task.session_id === 'string' ? task.session_id : null);
  const payload = adapter.name === 'codex'
    ? Buffer.from(request.prompt)
    : Buffer.from(JSON.stringify({
      protocol: 'marketcraft-jsonl-v1', ...request, permissions: settings.permissions,
      task_id: taskId, attempt: attemptNumber, operation: task.session_id ? 'resume' : 'start',
      session_id: task.session_id ?? null,
    }));
  if (payload.length > MAX_INPUT) {
    attempt.error = { code: 'input_limit', message: 'Provider input exceeded bounded evidence limits' };
    return 'unknown';
  }
  const elapsedLimit = Number((settings.budget as JsonRecord).max_elapsed_seconds) - Number(task.elapsed_seconds ?? 0);
  if (elapsedLimit <= 0) {
    attempt.error = { code: 'elapsed_budget_exhausted', message: 'Elapsed budget exhausted' };
    return 'timed_out';
  }
  const environment = providerEnvironment(adapter, String((settings.billing as JsonRecord).mode));
  const clean = redactor(process.env, adapter.environment);
  let child: ChildProcess;
  try {
    child = spawn(command[0] ?? '', command.slice(1), {
      cwd: root, env: environment, shell: false, detached: process.platform !== 'win32',
      stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
    });
  } catch (error) {
    attempt.error = { code: 'unavailable', message: (error as Error).message };
    return 'unavailable';
  }
  attempt.pid = child.pid;
  attempt.command_digest = digest(JSON.stringify(command));
  attempt.executable = path.basename(command[0] ?? '');
  attempt.evidence = `${directory}/events.jsonl`;
  const start = performance.now();
  let outputBytes = 0;
  let stopping: 'unknown' | 'canceled' | 'timed_out' | 'failed' | 'unavailable' | null = null;
  let terminalCount = 0;
  let terminationRequested = false;
  let killTimer: NodeJS.Timeout | undefined;
  let killTimerPromise: Promise<void> | undefined;
  let cancellationTimer: NodeJS.Timeout | undefined;
  let cancellationPollActive = false;
  let launchFailed = false;
  let closeCode: number | null = null;
  let closed = false;
  const outputPromises: Promise<void>[] = [];
  const requestTermination = (): void => {
    if (terminationRequested) return;
    terminationRequested = true;
    try {
      killGroup(child, 'SIGTERM');
    } catch (error) {
      if (!attempt.error) attempt.error = clean({ code: 'termination_failed', message: (error as Error).message });
    }
    killTimerPromise = new Promise<void>((resolve) => {
      killTimer = setTimeout(() => {
        try {
          killGroup(child, 'SIGKILL');
        } catch (error) {
          if (!attempt.error) attempt.error = clean({ code: 'termination_failed', message: (error as Error).message });
        } finally {
          resolve();
        }
      }, 200);
    });
  };
  const fail = (
    outcome: 'unknown' | 'canceled' | 'timed_out' | 'failed' | 'unavailable',
    error?: { code: string; message: string },
  ): void => {
    if (stopping === null) {
      stopping = outcome;
      if (error) attempt.error = clean(error);
    }
    requestTermination();
  };
  const closedPromise = new Promise<number | null>((resolve) => {
    child.once('error', (error) => {
      launchFailed = true;
      fail('unavailable', { code: 'unavailable', message: error.message });
      resolve(null);
    });
    child.once('close', (code) => {
      closed = true;
      closeCode = code;
      resolve(code);
    });
  });
  const interrupt = (): void => fail('canceled');
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);

  const appendEvent = async (stream: string, line: string): Promise<void> => {
    let parsed = stream === 'stdout' ? eventFromLine(line) : null;
    const safe = parsed ? clean(parsed) as JsonRecord : null;
    const event = safe ?? { type: 'unstructured', text: clean(line) };
    try {
      await appendFile(logPath, `${JSON.stringify({ stream, event })}\n`);
    } catch {
      fail('unknown', { code: 'evidence_write', message: 'Provider evidence could not be written' });
      return;
    }
    if (stream === 'stdout' && !safe) {
      fail('unknown', { code: 'invalid_protocol', message: 'Expected JSON object per stdout line' });
      return;
    }
    if (!safe) return;
    parsed = safe;
    if (['session.started', 'thread.started'].includes(String(parsed.type))) {
      const session = parsed.session_id ?? parsed.thread_id;
      if (adapter.kind !== 'agent-runtime' || typeof session !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(session)) {
        fail('unknown', { code: 'invalid_receipt', message: 'Invalid provider session receipt' });
        return;
      }
      task.session_id = session;
      if (typeof parsed.model === 'string') {
        task.resolved_model = parsed.model;
        attempt.resolved_model = parsed.model;
      }
    }
    if (adapter.name === 'codex' && parsed.type === 'item.completed') {
      const item = parsed.item;
      if (typeof item === 'object' && item !== null && (item as JsonRecord).type === 'agent_message') {
        attempt.output = (item as JsonRecord).text;
      }
    }
    const terminal = adapter.name === 'codex' ? parsed.type === 'turn.completed' : parsed.type === 'result';
    if (terminal) {
      terminalCount += 1;
      if (terminalCount > 1) {
        fail('unknown', { code: 'duplicate_completion', message: 'Provider emitted more than one completion event' });
        return;
      }
      if (adapter.name !== 'codex' && typeof parsed.status !== 'string') {
        fail('unknown', { code: 'invalid_terminal', message: 'Provider completion event needs a status string' });
        return;
      }
      attempt.terminal_status = adapter.name === 'codex' ? 'completed' : parsed.status as string;
      if (adapter.name !== 'codex' && 'output' in parsed) attempt.output = parsed.output;
      const usage = parsed.usage;
      if (typeof usage === 'object' && usage !== null && (adapter.name === 'codex' || (usage as JsonRecord).reliable === true)) {
        const typed = usage as JsonRecord;
        try {
          for (const field of ['input_tokens', 'output_tokens']) {
            if (typed[field] != null && (!Number.isInteger(typed[field]) || Number(typed[field]) < 0)) {
              throw new FoundryError(`reported ${field} must be a nonnegative integer`);
            }
          }
          attempt.usage_source = 'provider-reported; invoice/allowance not independently verified';
          attempt.usage = {
            input_tokens: typed.input_tokens == null ? null : number(typed.input_tokens, 'reported input_tokens'),
            output_tokens: typed.output_tokens == null ? null : number(typed.output_tokens, 'reported output_tokens'),
            api_dollars: typed.api_dollars == null ? null : number(typed.api_dollars, 'reported api_dollars'),
          };
        } catch (error) {
          fail('unknown', { code: 'invalid_usage', message: (error as Error).message });
          return;
        }
      }
    }
    if (parsed.type === 'error' || parsed.type === 'turn.failed') {
      fail('failed', {
        code: typeof parsed.code === 'string' ? parsed.code : 'provider_error',
        message: typeof parsed.message === 'string' ? parsed.message : 'Provider reported a failed turn',
      });
      return;
    }
    if (stream === 'stdout') {
      try {
        await withRegistryLock(root, async () => saveTask(root, task));
      } catch {
        fail('unknown', { code: 'task_write', message: 'Provider task state could not be saved' });
      }
    }
  };
  const consume = async (stream: Readable | null, label: string): Promise<void> => {
    if (!stream) return;
    const decoder = new StringDecoder('utf8');
    let pending = '';
    try {
      for await (const item of stream) {
        const chunk = Buffer.isBuffer(item) ? item : Buffer.from(item);
        outputBytes += chunk.length;
        if (outputBytes > MAX_OUTPUT) {
          fail('unknown', { code: 'output_limit', message: 'Provider output exceeded bounded evidence limits' });
          continue;
        }
        if (stopping) continue;
        pending += decoder.write(chunk);
        for (;;) {
          const newline = pending.indexOf('\n');
          if (newline < 0) break;
          const line = pending.slice(0, newline);
          pending = pending.slice(newline + 1);
          if (Buffer.byteLength(line, 'utf8') > MAX_LINE) {
            fail('unknown', { code: 'line_limit', message: 'Provider output exceeded the bounded line limit' });
            pending = '';
            break;
          }
          await appendEvent(label, line);
          if (stopping) break;
        }
        if (!stopping && Buffer.byteLength(pending, 'utf8') > MAX_LINE) {
          fail('unknown', { code: 'line_limit', message: 'Provider output exceeded the bounded line limit' });
          pending = '';
        }
      }
      const remainder = decoder.end();
      if (!stopping && remainder) {
        pending += remainder;
        if (Buffer.byteLength(pending, 'utf8') > MAX_LINE) {
          fail('unknown', { code: 'line_limit', message: 'Provider output exceeded the bounded line limit' });
        } else if (pending) {
          await appendEvent(label, pending);
        }
      } else if (!stopping && pending) {
        await appendEvent(label, pending);
      }
    } catch {
      fail('unknown', { code: 'evidence_write', message: 'Provider evidence could not be processed' });
    }
  };
  outputPromises.push(consume(child.stdout, 'stdout').catch(() => {
    fail('unknown', { code: 'evidence_write', message: 'Provider stdout could not be processed' });
  }));
  outputPromises.push(consume(child.stderr, 'stderr').catch(() => {
    fail('unknown', { code: 'evidence_write', message: 'Provider stderr could not be processed' });
  }));
  const onStdinError = (): void => {
    fail('unknown', { code: 'stdin_closed', message: 'Provider closed its input before the request was accepted' });
  };
  child.stdin?.on('error', onStdinError);
  let outcome = 'unknown';
  try {
    cancellationTimer = setInterval(() => {
      if (cancellationPollActive || stopping || closed) return;
      cancellationPollActive = true;
      void (async () => {
        try {
          if (await exists(root, `${STATE}/cancel/${taskId}.json`)) {
            fail('canceled');
          } else if (performance.now() - start >= elapsedLimit * 1000) {
            fail('timed_out', { code: 'elapsed_timeout', message: 'Provider exceeded its elapsed-time budget' });
          }
        } catch {
          fail('unknown', { code: 'cancel_check', message: 'Provider cancellation state could not be checked' });
        } finally {
          cancellationPollActive = false;
        }
      })();
    }, 100);
    try {
      await withRegistryLock(root, async () => saveTask(root, task));
    } catch {
      fail('unknown', { code: 'task_write', message: 'Provider task state could not be saved' });
    }
    if (!stopping) {
      if (!child.stdin) fail('unknown', { code: 'stdin_unavailable', message: 'Provider stdin is unavailable' });
      else {
        try {
          child.stdin.end(payload);
        } catch {
          fail('unknown', { code: 'stdin_closed', message: 'Provider request could not be written to stdin' });
        }
      }
    }
    closeCode = await closedPromise;
    await Promise.all(outputPromises);
    attempt.returncode = closeCode;
    attempt.terminal_count = terminalCount;
    attempt.elapsed_seconds = (performance.now() - start) / 1000;
    if (launchFailed) {
      (attempt.usage as JsonRecord).api_dollars = 0;
      outcome = 'unavailable';
    } else if (stopping) {
      outcome = stopping;
    } else if (attempt.error || closeCode !== 0) {
      fail('failed', attempt.error && typeof attempt.error === 'object'
        ? attempt.error as { code: string; message: string }
        : { code: 'provider_exit', message: 'Provider exited unsuccessfully' });
      outcome = stopping ?? 'failed';
    } else if (terminalCount !== 1 || attempt.terminal_status !== 'completed' || !('output' in attempt)) {
      fail('unknown', { code: 'missing_completion', message: 'Expected exactly one completed result with output' });
      outcome = stopping ?? 'unknown';
    } else if (adapter.kind === 'agent-runtime' && !task.session_id) {
      fail('unknown', { code: 'missing_session', message: 'Agent runtime did not provide a session receipt' });
      outcome = stopping ?? 'unknown';
    } else if (request.output_schema) {
      try {
        if (adapter.name === 'codex' && typeof attempt.output === 'string') attempt.output = JSON.parse(attempt.output);
        validateSchema(request.output_schema, attempt.output);
        outcome = 'completed';
      } catch (error) {
        fail('failed', { code: 'invalid_output', message: (error as Error).message });
        outcome = stopping ?? 'failed';
      }
    } else {
      outcome = 'completed';
    }
  } catch {
    fail('unknown', { code: 'runner_error', message: 'Provider process runner failed unexpectedly' });
    outcome = stopping ?? 'unknown';
  } finally {
    if (cancellationTimer) clearInterval(cancellationTimer);
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
    child.stdin?.off('error', onStdinError);
    if (closed && process.platform !== 'win32' && child.pid) {
      try {
        process.kill(-child.pid, 0);
        fail('unknown', { code: 'orphan_process_group', message: 'Provider left processes running in its owned process group' });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
          fail('unknown', { code: 'process_group_check', message: 'Provider process group could not be checked safely' });
        }
      }
    }
    if (stopping && killTimerPromise) await killTimerPromise;
    if (killTimer) clearTimeout(killTimer);
    if (!closed) {
      fail('unknown', { code: 'runner_interrupted', message: 'Provider process did not close cleanly' });
      if (killTimerPromise) await killTimerPromise;
      if (killTimer) clearTimeout(killTimer);
      let closeFallbackTimer: NodeJS.Timeout | undefined;
      try {
        await Promise.race([
          closedPromise,
          new Promise<void>((resolve) => { closeFallbackTimer = setTimeout(resolve, 1_000); }),
        ]);
      } finally {
        if (closeFallbackTimer) clearTimeout(closeFallbackTimer);
      }
    }
    if (!closed) {
      child.stdout?.destroy();
      child.stderr?.destroy();
      child.stdin?.destroy();
    }
    await Promise.allSettled(outputPromises);
    try {
      await rm(within(root, `${STATE}/cancel/${taskId}.json`), { force: true });
    } catch {
      if (!attempt.error) attempt.error = { code: 'cleanup_failed', message: 'Provider cancellation receipt could not be removed' };
      if (outcome === 'completed') outcome = 'unknown';
    }
    if (schemaPath) {
      try {
        await rm(within(root, schemaPath), { force: true });
      } catch {
        if (!attempt.error) attempt.error = { code: 'cleanup_failed', message: 'Provider schema file could not be removed' };
        if (outcome === 'completed') outcome = 'unknown';
      }
    }
    if (stopping && (outcome === 'unknown' || outcome === 'completed')) outcome = stopping;
  }
  return outcome;
}

export async function execute(
  rootInput: string,
  rawRequest: unknown,
  taskId?: string,
  options: ExecuteOptions = {},
): Promise<JsonRecord> {
  const root = await requireRuntimeWorkspace(rootInput, 'run a provider task');
  const request = requestSchema.parse(rawRequest);
  const { adapter, settings } = await prepare(root, request);
  const identifier = taskId ?? randomUUID();
  taskPath(root, identifier);
  const lock = providerPath(root, `leases/${identifier}.lock`);
  return withProcessLock(lock, async () => {
    let task: JsonRecord;
    let attempt: JsonRecord;
    return withRegistryLock(root, async () => {
      if (taskId) {
        task = await loadTask(root, taskId);
        if (canonicalJson(task.settings) !== canonicalJson(settings)) throw new FoundryError('Resume must preserve adapter, capabilities, model, permissions, schema, billing and budgets');
        if (task.status === 'running' || task.status === 'unknown') throw new FoundryError('Interrupted or ambiguous task needs reconciliation before resume');
        if (task.status === 'billing_violation') throw new FoundryError('Reported API charges contradict the billing contract; review the adapter before another task');
        if (task.session_id && !adapter.capabilities.includes('resume')) throw new FoundryError('Adapter cannot resume its existing session');
      } else {
        task = {
          schema_version: 1, adapter_contract_version: 1, task_id: identifier, created_at: now(),
          settings, status: 'ready', session_id: null, requested_model: settings.model,
          resolved_model: null, attempts: [], elapsed_seconds: 0,
        };
      }
      const attempts = Array.isArray(task.attempts) ? task.attempts : [];
      const budget = settings.budget as JsonRecord;
      if (attempts.length >= Number(budget.max_attempts)) throw new FoundryError('Attempt budget exhausted; resume never resets it');
      if (Number(task.elapsed_seconds ?? 0) >= Number(budget.max_elapsed_seconds)) throw new FoundryError('Elapsed budget exhausted');
      const active = (await taskList(root)).filter((item) => item.task_id !== identifier && ['running', 'unknown'].includes(String(item.status)));
      const concurrency = Math.min(Number(budget.max_concurrency), ...active.map((item) => Number(((item.settings as JsonRecord).budget as JsonRecord).max_concurrency)));
      if (active.length >= concurrency) throw new FoundryError('Project provider concurrency budget reached; reconcile unknown tasks first');
      if ((settings.billing as JsonRecord).mode === 'api') {
        const usage = (task.usage as JsonRecord | undefined) ?? {};
        if (attempts.length && usage.api_dollars === null) throw new FoundryError('Prior API cost is unknown; another paid attempt is blocked');
        const reserve = Number((settings.billing as JsonRecord).reservation_dollars);
        if (Number(usage.known_api_dollars ?? 0) + reserve > Number(budget.max_api_dollars)) {
          throw new FoundryError('API reservation would exceed the remaining known-dollar budget');
        }
      }
      attempt = {
        number: attempts.length + 1, started_at: now(), status: 'running',
        prompt_digest: digest(request.prompt), terminal_count: 0,
        requested_model: settings.model, resolved_model: null,
        usage: { input_tokens: null, output_tokens: null, api_dollars: null },
        api_reservation_dollars: (settings.billing as JsonRecord).reservation_dollars ?? 0,
        side_effects: 'not_verified',
      };
      attempts.push(attempt);
      task.attempts = attempts;
      task.status = 'running';
      await rm(within(root, `${STATE}/cancel/${identifier}.json`), { force: true });
      await saveTask(root, task);
      return task;
    }).then(async (saved) => {
      try {
        await options.onStarted?.(identifier);
      } catch (error) {
        await withRegistryLock(root, async () => {
          attempt.status = 'unknown';
          attempt.error = { code: 'start_callback', message: 'The controller could not persist its started task state' };
          saved.status = 'unknown';
          await saveTask(root, saved);
        });
        throw new FoundryError('Provider start callback failed; process execution was not started', { cause: error });
      }
      const outcome = await processTask(root, adapter, settings, request, saved, attempt);
    return withRegistryLock(root, async () => {
      attempt.status = outcome;
      attempt.finished_at = now();
      saved.status = outcome;
      saved.billing_assurance = 'request attestation; auth not inspected; no hard dollar cap with posthoc usage';
      const usage = summarizeUsage(saved.attempts as JsonRecord[]);
      saved.usage = usage;
      const knownApiDollars = Number(usage.known_api_dollars ?? 0);
      const budget = settings.budget as JsonRecord;
      if ((settings.billing as JsonRecord).mode === 'api' && knownApiDollars > Number(budget.max_api_dollars)) saved.status = 'budget_exceeded';
        else if ((settings.billing as JsonRecord).mode !== 'api' && knownApiDollars > 0) saved.status = 'billing_violation';
        await saveTask(root, saved);
        return saved;
      });
    });
  });
}

function summarizeUsage(attempts: JsonRecord[]): JsonRecord {
  let input = 0;
  let output = 0;
  let knownApi = 0;
  let hasKnownApi = false;
  let hasAllInput = attempts.length > 0;
  let hasAllOutput = attempts.length > 0;
  let hasAllApi = attempts.length > 0;
  for (const attempt of attempts) {
    const usage = attempt.usage as JsonRecord | undefined;
    if (typeof usage?.input_tokens === 'number') input += usage.input_tokens;
    else hasAllInput = false;
    if (typeof usage?.output_tokens === 'number') output += usage.output_tokens;
    else hasAllOutput = false;
    if (typeof usage?.api_dollars !== 'number') hasAllApi = false;
    else {
      knownApi += usage.api_dollars;
      hasKnownApi = true;
    }
  }
  return {
    input_tokens: hasAllInput ? input : null,
    output_tokens: hasAllOutput ? output : null,
    api_dollars: hasAllApi ? knownApi : null,
    known_api_dollars: hasKnownApi ? knownApi : 0,
    subscription_allowance_remaining: null,
  };
}

async function saveTask(root: string, task: JsonRecord): Promise<void> {
  task.updated_at = now();
  const attempts = task.attempts as JsonRecord[];
  task.usage = summarizeUsage(attempts);
  task.elapsed_seconds = attempts.reduce((total, item) => total + Number(item.elapsed_seconds ?? 0), 0);
  await atomicJson(root, `${STATE}/tasks/${String(task.task_id)}.json`, task);
}

export async function cancel(rootInput: string, taskId: string): Promise<JsonRecord> {
  const root = await requireRuntimeWorkspace(rootInput, 'cancel a provider task');
  return withRegistryLock(root, async () => {
    const task = await loadTask(root, taskId);
    if (task.status !== 'running') throw new FoundryError('Task is not running; inspect status or reconcile it');
    await atomicJson(root, `${STATE}/cancel/${taskId}.json`, { requested_at: now() });
    return { task_id: taskId, status: 'cancellation_requested', note: 'The live runner cancels its owned process group; request is not confirmation.' };
  });
}

export async function reconcile(rootInput: string, taskId: string, acknowledgeStopped = false): Promise<JsonRecord> {
  const root = await requireRuntimeWorkspace(rootInput, 'reconcile a provider task');
  taskPath(root, taskId);
  return withProcessLock(providerPath(root, `leases/${taskId}.lock`), async () => withRegistryLock(root, async () => {
    const task = await loadTask(root, taskId);
    if (!['running', 'unknown'].includes(String(task.status))) return task;
    task.status = acknowledgeStopped ? 'interrupted' : 'unknown';
    const attempts = task.attempts as JsonRecord[];
    const attempt = attempts.at(-1);
    if (attempt) {
    if (typeof attempt.finished_at !== 'string') {
        const startedAt = Date.parse(String(attempt.started_at));
        if (!Number.isFinite(startedAt)) throw new FoundryError('Provider attempt has an invalid start time');
        const elapsed = Math.max(0, (Date.now() - startedAt) / 1000);
        const priorElapsed = attempts.slice(0, -1).reduce((total, item) => total + Number(item.elapsed_seconds ?? 0), 0);
        const remaining = Math.max(0, Number(((task.settings as JsonRecord).budget as JsonRecord).max_elapsed_seconds) - priorElapsed);
        attempt.elapsed_seconds = Math.min(remaining, Math.max(elapsed, Number(attempt.elapsed_seconds ?? 0)));
      }
      attempt.status = task.status;
      attempt.reconciliation = {
        at: now(),
        owner_confirmed_stopped_and_effects_checked: acknowledgeStopped,
      };
    }
    await saveTask(root, task);
    return task;
  }));
}

export async function providerStatus(rootInput: string, taskId?: string): Promise<JsonRecord | JsonRecord[]> {
  const root = await findProjectRoot(rootInput);
  return taskId ? loadTask(root, taskId) : taskList(root);
}
