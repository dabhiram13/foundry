import { randomUUID } from 'node:crypto';
import { constants, lstatSync, realpathSync, readlinkSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { z } from 'zod';
import {
  atomicJson, atomicWrite, canonicalJson, digest, exists, findProjectRoot, FoundryError, now,
  readJson, rejectSymlinkComponents, within, withProcessLock,
} from './fs.js';
import { assertFactoryShipGate, readFactoryState } from './factory-contract.js';

const runtimeMarkerSchema = z.object({
  schema_version: z.literal(1),
  runtime: z.literal('typescript'),
  runtime_version: z.literal('1'),
  installed_at: z.string().min(1),
  source_pin: z.string().regex(/^[0-9a-f]{64}$/),
}).strict();

const checkSchema = z.object({
  name: z.string().regex(/^[A-Za-z0-9_-]+$/),
  command: z.array(z.string().min(1)).min(1),
  cwd: z.string().min(1).default('.'),
  timeout: z.number().positive().max(3600).default(120),
  required: z.boolean().default(true),
  inputs: z.array(z.string().min(1)).default([]),
  environment: z.array(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/)).default([]),
  test_report: z.string().optional(),
}).passthrough();

const projectSchema = z.object({
  name: z.string().min(1),
  checks: z.array(z.unknown()).default([]),
}).passthrough();

const activePointerSchema = z.object({
  run_id: z.string().uuid(),
  slug: z.string().min(1),
  schema_version: z.literal(1).optional(),
}).passthrough();

const runStatusSchema = z.enum([
  'building', 'paused', 'verifying', 'verified', 'completing', 'completed', 'failed',
]);

const relativePointerSchema = z.string().min(1).refine(
  (value) => !value.startsWith('/') && !value.split('/').includes('..') && !value.includes('\\') && !value.includes('\0'),
  'Pointer must be a project-relative path',
);

const runStateSchema = z.object({
  schema_version: z.literal(1).optional(),
  run_id: z.string().uuid(),
  slug: z.string().min(1),
  spec: z.string().min(1),
  status: runStatusSchema,
  started_at: z.string().min(1),
  updated_at: z.string().min(1),
  verification: relativePointerSchema.optional(),
  previous_verification: relativePointerSchema.optional(),
  completion: z.object({
    path: relativePointerSchema,
    text: z.string().min(1),
    completed_at: z.string().min(1),
  }).strict().optional(),
}).passthrough();

const testReportSchema = z.object({
  run_id: z.string().min(1),
  tests: z.object({
    executed: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
  }).strict(),
}).strict();

export type RuntimeMarker = z.infer<typeof runtimeMarkerSchema>;
export type CheckConfig = z.infer<typeof checkSchema>;
export type RunState = z.infer<typeof runStateSchema> & Record<string, unknown>;

export async function readRuntimeMarker(root: string): Promise<RuntimeMarker | null> {
  const markerPath = within(root, '.foundry/runtime.json');
  if (!(await exists(root, '.foundry/runtime.json'))) return null;
  try {
    return runtimeMarkerSchema.parse(await readJson(markerPath));
  } catch (error) {
    throw new FoundryError(`Invalid TypeScript runtime marker: ${(error as Error).message}`, { cause: error });
  }
}

export async function requireRuntimeWorkspace(root: string, operation: string): Promise<string> {
  const project = await findProjectRoot(root);
  const marker = await readRuntimeMarker(project);
  if (!marker) {
    throw new FoundryError(
      `Cannot ${operation} an unmarked or legacy workspace. Use the existing Python runtime until an explicit migration command is available.`,
    );
  }
  return project;
}

export async function projectConfig(root: string): Promise<{ name: string; checks: unknown[]; [key: string]: unknown }> {
  const absolute = within(root, '.foundry/project.json');
  try {
    return projectSchema.parse(await readJson(absolute));
  } catch (error) {
    throw new FoundryError(`Invalid .foundry/project.json: ${(error as Error).message}`, { cause: error });
  }
}

export async function configuredChecks(root: string): Promise<CheckConfig[]> {
  const config = await projectConfig(root);
  const items = config.checks;
  if (!items.length || !items.some((item) => {
    const parsed = checkSchema.safeParse(item);
    return parsed.success && parsed.data.required;
  })) {
    throw new FoundryError('Verification unavailable: configure at least one required behavior/build check.');
  }
  const names = new Set<string>();
  const checks: CheckConfig[] = [];
  for (const raw of items) {
    const result = checkSchema.safeParse(raw);
    if (!result.success) {
      const name = typeof raw === 'object' && raw !== null && 'name' in raw ? String(raw.name) : 'check';
      throw new FoundryError(`${name}: invalid check configuration (${result.error.issues.map((issue) => issue.message).join('; ')})`);
    }
    const check = result.data;
    if (names.has(check.name)) throw new FoundryError('Duplicate check name');
    names.add(check.name);
    const cwd = within(root, check.cwd);
    try {
      if (!(await stat(cwd)).isDirectory()) throw new FoundryError(`${check.name}: cwd does not exist`);
    } catch (error) {
      if (error instanceof FoundryError) throw error;
      throw new FoundryError(`${check.name}: cwd does not exist`, { cause: error });
    }
    for (const input of check.inputs) within(root, input);
    if (check.test_report !== undefined) {
      if (check.test_report.split('/').includes('.git') || path.isAbsolute(check.test_report) || path.win32.isAbsolute(check.test_report)) {
        throw new FoundryError(`${check.name}: test_report must be a project-relative output file`);
      }
      within(root, check.test_report);
    }
    checks.push(check);
  }
  if (!checks.some((check) => check.required)) {
    throw new FoundryError('Verification unavailable: configure at least one required behavior/build check.');
  }
  return checks;
}

async function declaredFiles(root: string, relative: string): Promise<string[]> {
  const absolute = within(root, relative);
  let stats;
  try {
    stats = await stat(absolute);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new FoundryError(`Declared verification input is missing: ${relative}`);
    }
    throw error;
  }
  if (stats.isFile()) return [absolute];
  if (!stats.isDirectory()) throw new FoundryError(`Declared verification input is missing: ${relative}`);
  const output: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    for (const entry of entries) {
      const child = path.join(directory, entry.name);
      within(root, path.relative(root, child).split(path.sep).join('/'));
      if (entry.isDirectory()) {
        if (entry.name === '__pycache__') continue;
        await visit(child);
      } else if (entry.isFile()) {
        if (!['.pyc', '.pyo'].includes(path.extname(entry.name))) output.push(child);
      } else if (entry.isSymbolicLink()) {
        throw new FoundryError(`Symlink inputs are not allowed: ${child}`);
      }
    }
  };
  await visit(absolute);
  return output;
}

async function sourceFiles(root: string): Promise<string[]> {
  const exclusions = new Set(['.git', '__pycache__', '.venv', 'node_modules', '.next', 'coverage', 'dist', 'build']);
    const git = spawnSyncOutput('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], root);
  let candidates: string[];
  if (git !== null) {
    candidates = git.toString('utf8').split('\0').filter(Boolean).map((name) => within(root, name));
  } else {
    candidates = [];
    const visit = async (directory: string): Promise<void> => {
      const entries = await readdir(directory, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && exclusions.has(entry.name)) continue;
        const child = path.join(directory, entry.name);
        const childRelative = path.relative(root, child).split(path.sep).join('/');
        if (entry.isDirectory() && (childRelative === '.foundry/state' || childRelative === '.foundry/update-conflicts')) continue;
        within(root, path.relative(root, child).split(path.sep).join('/'));
        if (entry.isDirectory()) await visit(child);
        else candidates.push(child);
      }
    };
    await visit(root);
  }
  const output = new Set<string>();
  for (const file of candidates) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    const parts = relative.split('/');
    if (parts.some((part) => exclusions.has(part))) continue;
    if (parts[0] === '.foundry' && parts[1] === 'state') continue;
    if (parts[0] === '.foundry' && parts[1] === 'update-conflicts') continue;
    if (relative === '.foundry/install.json' || relative === '.foundry/install-pending.json') continue;
    let entry;
    try {
      entry = lstatSync(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    if (entry.isFile() || entry.isSymbolicLink()) output.add(file);
  }
  output.add(within(root, '.foundry/project.json'));
  const [, state] = await activeRun(root);
  if (state?.spec) output.add(within(root, state.spec));
  const walkEnv = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const child = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (exclusions.has(entry.name) || (path.relative(root, child) === '.foundry/state') || entry.isSymbolicLink()) continue;
        await walkEnv(child);
      } else if (entry.name === '.env' || entry.name.startsWith('.env.')) {
        output.add(within(root, path.relative(root, child).split(path.sep).join('/')));
      }
    }
  };
  await walkEnv(root);
  for (const check of await configuredChecks(root)) {
    for (const input of check.inputs) {
      for (const file of await declaredFiles(root, input)) output.add(file);
    }
  }
  return [...output].sort();
}

function spawnSyncOutput(command: string, args: string[], cwd: string): Buffer | null {
  const result = spawnSync(command, args, { cwd, encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 });
  return result.error || result.status !== 0 ? null : result.stdout;
}

function executableFor(command: string, cwd: string): string | null {
  const hasSeparator = command.includes('/') || command.includes(path.sep);
  const candidates = hasSeparator
    ? [path.isAbsolute(command) ? command : path.resolve(cwd, command)]
    : (process.env.PATH ?? '').split(path.delimiter).map((entry) => path.resolve(cwd, entry || '.', command));
  for (const candidate of candidates) {
    try {
      const resolved = realpathSync(candidate);
      if (lstatSync(resolved).isFile() && (lstatSync(resolved).mode & constants.S_IXUSR) !== 0) return resolved;
    } catch {
      continue;
    }
  }
  return null;
}

export async function workspaceRevision(root: string, exclude: readonly string[] = []): Promise<string> {
  const files: Record<string, string> = {};
  for (const file of await sourceFiles(root)) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    if (exclude.includes(relative)) continue;
    const stats = lstatSync(file);
    files[relative] = stats.isSymbolicLink()
      ? digest(`symlink:${readlinkSync(file)}`)
      : digest(Buffer.concat([await readFile(file), Buffer.from(String(stats.mode & 0o777))]));
  }
  const index = spawnSyncOutput('git', ['ls-files', '--stage', '-z'], root);
  const head = spawnSyncOutput('git', ['rev-parse', 'HEAD'], root);
  const branch = spawnSyncOutput('git', ['symbolic-ref', '-q', 'HEAD'], root);
  const environment: Record<string, string> = {};
  const executables: Record<string, unknown> = {};
  for (const check of await configuredChecks(root)) {
    for (const name of check.environment) environment[name] = digest(canonicalJson(process.env[name] ?? null));
    const cwd = within(root, check.cwd);
    const resolved = executableFor(check.command[0] ?? '', cwd);
    if (!resolved) {
      executables[check.name] = null;
      continue;
    }
    const stats = lstatSync(resolved);
    executables[check.name] = {
      path: resolved,
      sha256: digest(await readFile(resolved)),
      mode: stats.mode & 0o777,
      executable: (stats.mode & constants.S_IXUSR) !== 0,
    };
  }
  const material = {
    fingerprint_schema: 1,
    runtime: 'typescript',
    files,
    index: index ? digest(index) : null,
    git_head: head?.toString('utf8').trim() ?? null,
    git_branch: branch?.toString('utf8').trim() ?? null,
    environment,
    executables,
    node: process.version,
  };
  return digest(canonicalJson(material));
}

async function declaredRevisions(root: string, check: CheckConfig): Promise<Record<string, string>> {
  const revisions: Record<string, string> = {};
  for (const input of check.inputs) {
    for (const file of await declaredFiles(root, input)) {
      revisions[path.relative(root, file).split(path.sep).join('/')] = digest(await readFile(file));
    }
  }
  return revisions;
}

function redact(text: string): string {
  return text.replace(/\b(?:sk-(?:proj-)?|gh[pousr]_|github_pat_|AKIA)[A-Za-z0-9_-]{16,}\b/g, '[REDACTED]')
    .replace(/((?:api[_-]?key|secret|access[_-]?token|password)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]');
}

interface CheckReceipt {
  name: string;
  command: string[];
  cwd: string;
  timeout: number;
  required: boolean;
  input_revisions: Record<string, string>;
  input_revisions_after: Record<string, string>;
  started_at: string;
  finished_at: string;
  exit_code: number | null;
  status: string;
  duration_seconds: number;
  log: string;
  log_sha256: string;
  [key: string]: unknown;
}

const MAX_CHECK_OUTPUT = 8 * 1024 * 1024;

function signalChild(child: ChildProcess, signal: NodeJS.Signals): void {
  try {
    if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
}

async function terminateSurvivingGroup(child: ChildProcess): Promise<boolean> {
  if (process.platform === 'win32' || !child.pid) return false;
  try {
    process.kill(-child.pid, 0);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
    signalChild(child, 'SIGKILL');
    return true;
  }
  signalChild(child, 'SIGTERM');
  let graceTimer: NodeJS.Timeout | undefined;
  try {
    await new Promise<void>((resolve) => { graceTimer = setTimeout(resolve, 150); });
  } finally {
    if (graceTimer) clearTimeout(graceTimer);
  }
  try {
    process.kill(-child.pid, 0);
    signalChild(child, 'SIGKILL');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') signalChild(child, 'SIGKILL');
  }
  return true;
}

async function runCheck(
  root: string,
  check: CheckConfig,
  logRelative: string,
  runId: string,
  cancelRequested: () => boolean,
): Promise<{ receipt: CheckReceipt; interrupted: boolean }> {
  const started = now();
  const clock = performance.now();
  const checkRunId = randomUUID();
  const before = await declaredRevisions(root, check);
  const logPath = within(root, logRelative);
  let output = Buffer.alloc(0);
  let child: ChildProcess | null = null;
  let exitCode: number | null = null;
  let status = 'unavailable';
  let interrupted = false;
  let timedOut = false;
  let outputLimit = false;
  let launchError: string | null = null;
  let orphanProcessGroup = false;
  let closed = false;
  let timeout: NodeJS.Timeout | undefined;
  let cancellation: NodeJS.Timeout | undefined;
  let outputHandler: ((chunk: Buffer) => void) | undefined;
  let childErrorHandler: ((error: Error) => void) | undefined;
  let childCloseHandler: ((code: number | null) => void) | undefined;
  const reportPath = check.test_report ? within(root, check.test_report) : null;
  if (reportPath) {
    await rm(reportPath, { force: true });
  }
  try {
    const env = reportPath
      ? { ...process.env, FOUNDRY_CHECK_ID: checkRunId, FOUNDRY_TEST_REPORT: reportPath }
      : process.env;
    child = spawn(check.command[0] ?? '', check.command.slice(1), {
      cwd: within(root, check.cwd),
      env,
      shell: false,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const childRef = child;
    const appendOutput = (chunk: Buffer): void => {
      if (output.length + chunk.length > MAX_CHECK_OUTPUT) {
        outputLimit = true;
        signalChild(childRef, 'SIGKILL');
        return;
      }
      output = Buffer.concat([output, chunk]);
    };
    outputHandler = appendOutput;
    child.stdout?.on('data', appendOutput);
    child.stderr?.on('data', appendOutput);
    const onChildError = (error: Error): void => {
      launchError = error.message;
      status = 'unavailable';
    };
    childErrorHandler = onChildError;
    child.once('error', onChildError);
    const closePromise = new Promise<number | null>((resolve) => {
      const onChildClose = (code: number | null): void => {
        closed = true;
        resolve(code);
      };
      childCloseHandler = onChildClose;
      childRef.once('close', onChildClose);
    });
    timeout = setTimeout(() => {
      timedOut = true;
      signalChild(childRef, 'SIGKILL');
    }, check.timeout * 1000);
    cancellation = setInterval(() => {
      if (!closed && cancelRequested()) {
        interrupted = true;
        signalChild(childRef, 'SIGKILL');
      }
    }, 100);
    exitCode = await closePromise;
    if (interrupted) status = 'interrupted';
    else if (timedOut) status = 'timed_out';
    else if (outputLimit) status = 'output_limit';
    else if (launchError) status = 'unavailable';
    else status = exitCode === 0 ? 'passed' : 'failed';
  } catch (error) {
    launchError = (error as Error).message;
    status = 'unavailable';
  } finally {
    if (timeout) clearTimeout(timeout);
    if (cancellation) clearInterval(cancellation);
    if (child) {
      if (outputHandler) {
        child.stdout?.off('data', outputHandler);
        child.stderr?.off('data', outputHandler);
      }
      if (childErrorHandler) child.off('error', childErrorHandler);
      if (childCloseHandler) child.off('close', childCloseHandler);
      if (child.exitCode === null && child.signalCode === null) signalChild(child, 'SIGKILL');
      else {
        try {
          orphanProcessGroup = await terminateSurvivingGroup(child);
        } catch {
          orphanProcessGroup = true;
        }
      }
    }
  }
  if (orphanProcessGroup) {
    status = 'failed';
    launchError = 'Check left processes running in its owned process group; descendants were terminated.';
  }
  if (launchError) output = Buffer.concat([output, Buffer.from(launchError)]);
  const reportFields: Record<string, unknown> = {};
  if (reportPath) {
    try {
      const data = testReportSchema.parse(await readJson(reportPath));
      if (data.run_id !== checkRunId) throw new FoundryError('Test report does not identify this execution');
      const counts = data.tests;
      if (counts.executed <= 0 || counts.executed !== counts.passed + counts.failed) {
        throw new FoundryError('Test report needs nonzero, consistent executed counts');
      }
      const savedReport = `${logRelative.replace(/\.log$/, '')}.tests.json`;
      await atomicJson(root, savedReport, data);
      reportFields.tests = counts;
      reportFields.check_run_id = checkRunId;
      reportFields.test_report = savedReport;
      reportFields.test_report_sha256 = digest(await readFile(within(root, savedReport)));
      if (counts.failed || counts.skipped) throw new FoundryError('Required test report contains failed or skipped tests');
    } catch (error) {
      reportFields.test_report_error = (error as Error).message;
      if (status === 'passed') status = 'failed';
    }
  }
  const after = await declaredRevisions(root, check);
  if (status === 'passed' && JSON.stringify(before) !== JSON.stringify(after)) {
    status = 'failed';
    reportFields.mutation_error = 'Required check changed its declared product inputs';
  }
  const outputText = redact(output.toString('utf8'));
  await atomicWrite(root, logRelative, outputText);
  const receipt: CheckReceipt = {
    name: check.name,
    command: check.command,
    cwd: check.cwd,
    timeout: check.timeout,
    required: check.required,
    input_revisions: before,
    input_revisions_after: after,
    started_at: started,
    finished_at: now(),
    exit_code: exitCode,
    status,
    duration_seconds: (performance.now() - clock) / 1000,
    log: logRelative,
    log_sha256: digest(await readFile(logPath)),
    ...reportFields,
  };
  return { receipt, interrupted };
}

export async function activeRun(root: string): Promise<[string | null, RunState | null]> {
  const pointerPath = within(root, '.foundry/state/active.json');
  if (!(await exists(root, '.foundry/state/active.json'))) return [null, null];
  const pointer = activePointerSchema.parse(await readJson(pointerPath));
  const statePath = within(root, `.foundry/state/runs/${pointer.run_id}/state.json`);
  const state = runStateSchema.parse(await readJson(statePath));
  if (state.run_id !== pointer.run_id || state.slug !== pointer.slug) {
    throw new FoundryError('Active pointer does not match run state');
  }
  return [path.relative(root, statePath).split(path.sep).join('/'), state];
}

async function requireActive(root: string): Promise<[string, RunState]> {
  const [relative, state] = await activeRun(root);
  if (!relative || !state) throw new FoundryError('No active run. Use start SLUG --spec PATH.');
  return [relative, state];
}

export async function start(rootInput: string, slug: string, spec: string): Promise<RunState> {
  const root = await requireRuntimeWorkspace(rootInput, 'start');
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) {
    throw new FoundryError('Use a lowercase feature slug with letters, numbers and hyphens');
  }
  const specPath = within(root, spec);
  let contents: string;
  try {
    contents = await readFile(specPath, 'utf8');
  } catch (error) {
    throw new FoundryError('A nonempty local spec is required', { cause: error });
  }
  if (!contents.trim()) throw new FoundryError('A nonempty local spec is required');
  return withProcessLock(within(root, '.foundry/state/coordinator.lock'), async () => {
    const [, current] = await activeRun(root);
    if (current) throw new FoundryError(`Resume active run ${current.slug} (${current.status}) before starting another.`);
    const runId = randomUUID();
    const relativeSpec = path.relative(root, specPath).split(path.sep).join('/');
    const state: RunState = {
      run_id: runId,
      slug,
      spec: relativeSpec,
      status: 'building',
      started_at: now(),
      updated_at: now(),
    };
    await atomicJson(root, `.foundry/state/runs/${runId}/state.json`, state);
    await atomicJson(root, '.foundry/state/active.json', { run_id: runId, slug });
    return state;
  });
}

export async function pauseOrResume(rootInput: string, pause: boolean): Promise<RunState> {
  const root = await requireRuntimeWorkspace(rootInput, pause ? 'pause' : 'resume');
  return withProcessLock(within(root, '.foundry/state/coordinator.lock'), async () => {
    const [statePath, current] = await requireActive(root);
    if (['completing', 'completed', 'verifying'].includes(current.status)) {
      throw new FoundryError('Use recover to reconcile the interrupted operation before resuming.');
    }
    const state: RunState = {
      ...current,
      status: pause ? 'paused' : 'building',
      updated_at: now(),
    };
    if (!pause) delete state.verification;
    await atomicJson(root, statePath, state);
    return state;
  });
}

export async function verify(rootInput: string, cancelRequested: () => boolean = () => false): Promise<number> {
  const root = await requireRuntimeWorkspace(rootInput, 'verify');
  return withProcessLock(within(root, '.foundry/state/coordinator.lock'), async () => {
    const [statePath, state] = await requireActive(root);
    if (['completing', 'completed', 'verifying'].includes(state.status)) {
      throw new FoundryError('Recover the interrupted run before verifying again.');
    }
    const checks = await configuredChecks(root);
    const before = await workspaceRevision(root);
    const batchName = `.foundry/state/runs/${state.run_id}/verification-${randomUUID()}`;
    const receipts: CheckReceipt[] = [];
    const evidence: Record<string, unknown> = {
      run_id: state.run_id,
      created_at: now(),
      inputs_before: before,
      inputs_after: null,
      passed: false,
      status: 'running',
      checks: receipts,
    };
    await atomicJson(root, `${batchName}/receipts.json`, evidence);
    await atomicJson(root, statePath, { ...state, status: 'verifying', verification: `${batchName}/receipts.json`, updated_at: now() });
    let interrupted = false;
    const interrupt = (): void => { interrupted = true; };
    process.on('SIGINT', interrupt);
    process.on('SIGTERM', interrupt);
    try {
      for (const check of checks) {
        if (interrupted || cancelRequested()) {
          interrupted = true;
          break;
        }
        evidence.current_check = check.name;
        await atomicJson(root, `${batchName}/receipts.json`, evidence);
        const result = await runCheck(
          root,
          check,
          `${batchName}/${check.name}.log`,
          state.run_id,
          () => interrupted || cancelRequested(),
        );
        result.receipt.run_id = state.run_id;
        result.receipt.inputs_sha256 = before;
        receipts.push(result.receipt);
        if (result.interrupted) interrupted = true;
        delete evidence.current_check;
        await atomicJson(root, `${batchName}/receipts.json`, evidence);
      }
    } finally {
      process.off('SIGINT', interrupt);
      process.off('SIGTERM', interrupt);
    }
    interrupted = interrupted || cancelRequested();
    const after = await workspaceRevision(root);
    const passed = !interrupted
      && receipts.length === checks.length
      && receipts.every((receipt) => !receipt.required || (receipt.status === 'passed' && receipt.exit_code === 0))
      && before === after;
    evidence.inputs_after = after;
    evidence.passed = passed;
    evidence.status = interrupted ? 'interrupted' : passed ? 'passed' : 'failed';
    await atomicJson(root, `${batchName}/receipts.json`, evidence);
    const nextState: RunState = {
      ...state,
      status: interrupted ? 'paused' : passed ? 'verified' : 'building',
      verification: `${batchName}/receipts.json`,
      updated_at: now(),
    };
    await atomicJson(root, statePath, nextState);
    return passed ? 0 : interrupted ? 130 : 1;
  });
}

function exactTestCounts(value: unknown): value is { executed: number; passed: number; failed: number; skipped: number } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const counts = value as Record<string, unknown>;
  return Object.keys(counts).sort().join(',') === 'executed,failed,passed,skipped'
    && Object.values(counts).every((count) => typeof count === 'number' && Number.isInteger(count) && count >= 0)
    && (counts.executed as number) > 0
    && counts.executed === (counts.passed as number) + (counts.failed as number);
}

async function completionEvidence(root: string, state: RunState): Promise<[string, Record<string, unknown>[]]> {
  const verification = typeof state.verification === 'string' ? state.verification : '';
  if (!verification) throw new FoundryError('Completion needs a fresh successful verify run.');
  const evidence = await readJson<Record<string, unknown>>(within(root, verification));
  const completion = typeof state.completion === 'object' && state.completion !== null
    ? state.completion as { path?: string }
    : null;
  const fingerprint = await workspaceRevision(root, completion?.path ? [completion.path] : []);
  if (evidence.run_id !== state.run_id || evidence.passed !== true
    || evidence.inputs_before !== fingerprint || evidence.inputs_after !== fingerprint) {
    throw new FoundryError('Verification is stale or mismatched. Run verify again.');
  }
  const checks = await configuredChecks(root);
  const receipts = evidence.checks;
  if (!Array.isArray(receipts) || receipts.length !== checks.length) throw new FoundryError('Missing check receipts');
  const validated: Record<string, unknown>[] = [];
  for (let index = 0; index < checks.length; index += 1) {
    const check = checks[index];
    const raw = receipts[index];
    if (!check || typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new FoundryError('Malformed check receipt');
    }
    const receipt = raw as Record<string, unknown>;
    const settings: [string, unknown][] = [
      ['name', check.name], ['command', check.command], ['cwd', check.cwd],
      ['required', check.required], ['timeout', check.timeout],
    ];
    for (const [key, expected] of settings) {
      if (JSON.stringify(receipt[key]) !== JSON.stringify(expected)) throw new FoundryError('Receipt does not match configured check');
    }
    if (receipt.run_id !== state.run_id || receipt.inputs_sha256 !== fingerprint) {
      throw new FoundryError('Receipt does not match current run and inputs');
    }
    if (canonicalJson(receipt.input_revisions) !== canonicalJson(receipt.input_revisions_after)) {
      throw new FoundryError('Check inputs changed during verification');
    }
    if (check.required && (receipt.status !== 'passed' || receipt.exit_code !== 0)) {
      throw new FoundryError('Required check did not pass');
    }
    const retainedReport = ['test_report', 'test_report_sha256', 'check_run_id', 'tests'].some((key) => key in receipt);
    if (check.test_report && (check.required || receipt.status === 'passed' || retainedReport)) {
      const reportRelative = typeof receipt.test_report === 'string' ? receipt.test_report : '';
      const reportPath = within(root, reportRelative);
      let reportBytes: Buffer;
      try {
        reportBytes = await readFile(reportPath);
      } catch {
        throw new FoundryError('Receipt test report missing or changed');
      }
      if (digest(reportBytes) !== receipt.test_report_sha256) throw new FoundryError('Receipt test report missing or changed');
      const report = testReportSchema.parse(JSON.parse(reportBytes.toString('utf8')));
      if (report.run_id !== receipt.check_run_id || JSON.stringify(report.tests) !== JSON.stringify(receipt.tests)
        || !exactTestCounts(report.tests)) {
        throw new FoundryError('Receipt test report does not match its execution and counts');
      }
      if (check.required && (report.tests.failed || report.tests.skipped)) {
        throw new FoundryError('Required test report contains failed or skipped tests');
      }
    }
    const logPath = within(root, typeof receipt.log === 'string' ? receipt.log : '');
    const log = await readFile(logPath).catch(() => null);
    if (!log || digest(log) !== receipt.log_sha256) throw new FoundryError('Receipt log missing or changed');
    validated.push(receipt);
  }
  return [fingerprint, validated];
}

export async function complete(rootInput: string): Promise<number> {
  const root = await requireRuntimeWorkspace(rootInput, 'complete');
  return withProcessLock(within(root, '.foundry/state/coordinator.lock'), async () => {
    const [statePath, current] = await activeRun(root);
    if (!current || !statePath) {
      if (await exists(root, '.foundry/state/last-completed.json')) {
        const ref = await readJson<{ run_id?: string; state?: string }>(within(root, '.foundry/state/last-completed.json'));
        if (ref.state) {
          const completed = runStateSchema.parse(await readJson(within(root, ref.state)));
          if (completed.status === 'completed' && completed.run_id === ref.run_id) {
            const factory = await readFactoryState(root);
            if (factory) {
              if (factory.lifecycle_run_id !== completed.run_id || !completed.verification) {
                throw new FoundryError('Factory controller does not own this completed lifecycle run');
              }
              await assertFactoryShipGate(
                root,
                completed.run_id,
                completed.verification,
                await workspaceRevision(root, typeof completed.built_doc === 'string' ? [completed.built_doc] : []),
              );
            }
            return 0;
          }
        }
      }
      throw new FoundryError('No active run. Use start SLUG --spec PATH.');
    }
    if (!['verified', 'completing', 'completed'].includes(current.status) || !current.verification) {
      throw new FoundryError('Completion needs a fresh successful verify run.');
    }
    const factory = await readFactoryState(root);
    if (factory) {
      if (factory.lifecycle_run_id !== current.run_id) {
        throw new FoundryError('Factory controller does not own this lifecycle run');
      }
      await assertFactoryShipGate(
        root,
        current.run_id,
        current.verification,
        await workspaceRevision(root, current.completion?.path ? [current.completion.path] : []),
      );
    }
    let state = current;
    if (state.status !== 'completed') {
      const [fingerprint, receipts] = await completionEvidence(root, state);
      if (!state.completion) {
        let output = `.foundry/state/runs/${state.run_id}/completion.md`;
        const defaultPath = `docs/built/${state.slug}.md`;
        if (await exists(root, defaultPath)) output = `docs/built/${state.slug}-${state.run_id}.md`;
        if (await exists(root, output)) throw new FoundryError('Completion output already exists; preserve it and reconcile before retrying.');
        const completedAt = now();
        const text = `# ${state.slug}\n\nVerified locally at ${completedAt}.\n\nSpec: \`${state.spec}\`\nRun: \`${state.run_id}\`\nInputs: \`${fingerprint}\`\nReceipts: \`${state.verification}\`\n\n${receipts.map((receipt) => `- ${String(receipt.name)}: ${String(receipt.status)} (exit ${String(receipt.exit_code)})`).join('\n')}\n\nThis records configured local checks; owner acceptance and production qualification are separate.\n`;
        state = { ...state, status: 'completing', completion: { path: output, text, completed_at: completedAt } };
        await atomicJson(root, statePath, state);
      }
      const intent = state.completion as { path: string; text: string; completed_at: string };
      const outputPath = within(root, intent.path);
      const existing = await readFile(outputPath, 'utf8').catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return null;
        throw error;
      });
      if (existing !== null && existing !== intent.text) {
        throw new FoundryError('Completion output changed; preserved for manual reconciliation.');
      }
      if (existing === null) await atomicWrite(root, intent.path, intent.text);
      state = {
        ...state,
        status: 'completed',
        completed_at: intent.completed_at,
        built_doc: intent.path,
      };
      await atomicJson(root, statePath, state);
    }
    await atomicJson(root, '.foundry/state/last-completed.json', {
      run_id: state.run_id,
      state: statePath,
    });
    const activePointer = within(root, '.foundry/state/active.json');
    await rm(activePointer);
    return 0;
  });
}

export async function recover(rootInput: string): Promise<RunState | null> {
  const root = await requireRuntimeWorkspace(rootInput, 'recover');
  return withProcessLock(within(root, '.foundry/state/coordinator.lock'), async () => {
    const [statePath, state] = await requireActive(root);
    if (state.status === 'completed') {
      const factory = await readFactoryState(root);
      if (factory) {
        if (factory.lifecycle_run_id !== state.run_id || !state.verification) {
          throw new FoundryError('Factory controller does not own this completed lifecycle run');
        }
        await assertFactoryShipGate(
          root,
          state.run_id,
          state.verification,
          await workspaceRevision(root, typeof state.built_doc === 'string' ? [state.built_doc] : []),
        );
      }
      await atomicJson(root, '.foundry/state/last-completed.json', {
        run_id: state.run_id,
        state: statePath,
      });
      await rm(within(root, '.foundry/state/active.json'));
      return state;
    }
    if (state.status === 'completing') {
      try {
        const factory = await readFactoryState(root);
        if (factory) {
          if (factory.lifecycle_run_id !== state.run_id || !state.verification) {
            throw new FoundryError('Factory controller does not own this completing lifecycle run');
          }
          const intent = state.completion as { path?: string } | undefined;
          await assertFactoryShipGate(
            root,
            state.run_id,
            state.verification,
            await workspaceRevision(root, intent?.path ? [intent.path] : []),
          );
        }
        await completionEvidence(root, state);
        const intent = state.completion as { path: string; text: string; completed_at: string };
        const output = await readFile(within(root, intent.path), 'utf8').catch((error: NodeJS.ErrnoException) => {
          if (error.code === 'ENOENT') return null;
          throw error;
        });
        if (output !== null && output !== intent.text) throw new FoundryError('Completion output changed; owner version preserved.');
        if (output === null) await atomicWrite(root, intent.path, intent.text);
        const completed: RunState = {
          ...state,
          status: 'completed',
          completed_at: intent.completed_at,
          built_doc: intent.path,
          updated_at: now(),
        };
        await atomicJson(root, statePath, completed);
        await atomicJson(root, '.foundry/state/last-completed.json', {
          run_id: completed.run_id,
          state: statePath,
        });
        await rm(within(root, '.foundry/state/active.json'));
        return completed;
      } catch (error) {
        const intent = state.completion as { path: string; text: string };
        if (intent?.path) {
          const output = await readFile(within(root, intent.path), 'utf8').catch(() => null);
          if (output === intent.text) {
            await atomicWrite(root, `.foundry/state/runs/${state.run_id}/abandoned-completion.md`, intent.text);
            await rm(within(root, intent.path));
          }
        }
        const paused: RunState = {
          ...state,
          status: 'paused',
          updated_at: now(),
          abandoned_completion: { intent, reason: (error as Error).message, at: now() },
        };
        delete paused.completion;
        if (paused.verification) paused.previous_verification = paused.verification;
        delete paused.verification;
        await atomicJson(root, statePath, paused);
        return paused;
      }
    }
    if (state.status === 'verifying' && typeof state.verification === 'string') {
      const evidencePath = within(root, state.verification);
      const evidence = await readJson<Record<string, unknown>>(evidencePath);
      await atomicJson(root, state.verification, {
        ...evidence,
        passed: false,
        status: 'interrupted',
        recovered_at: now(),
        recovery_note: 'Coordinator disappeared. Any unfinished check is unverified; inspect possible orphan processes before retrying.',
      });
        const paused: RunState = { ...state, status: 'paused', updated_at: now() };
      await atomicJson(root, statePath, paused);
      return paused;
    }
    return state;
  });
}

export async function status(rootInput: string): Promise<Record<string, unknown>> {
  const root = await findProjectRoot(rootInput);
  const marker = await readRuntimeMarker(root);
  const [, active] = await activeRun(root);
  return {
    runtime_owner: marker ? 'typescript' : 'unmarked-or-legacy',
    active: active ?? { status: 'idle' },
  };
}
