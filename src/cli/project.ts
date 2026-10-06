import { readFile } from 'node:fs/promises';
import { FoundryError, normalizeLocalPath, within } from '../core/fs.js';
import { complete, pauseOrResume, recover, start, status, verify } from '../core/lifecycle.js';
import { context, gate, guide, record } from '../core/workflow.js';
import { cancel, execute, inspectAdapter, providerStatus, registry, reconcile } from '../runtime/providers.js';
import { writeResult } from './output.js';

type Options = Record<string, string | boolean | string[]>;
type JsonRecord = Record<string, unknown>;

interface OptionSpec {
  value?: readonly string[];
  list?: readonly string[];
  boolean?: readonly string[];
  positional?: number;
}

function usage(): string {
  return `Foundry scoped work and provider operations

Usage:
  foundry work status [--project PATH]
  foundry work start SLUG --spec PATH [--project PATH]
  foundry work pause|resume|verify|complete|recover [--project PATH]
  foundry work workflow guide|context|gate|record|feedback [options]
  foundry provider [--project PATH]
  foundry provider run --adapter NAME --prompt TEXT [--project PATH] [--billing MODE]
  foundry provider run --request PATH [--project PATH]
  foundry provider status [TASK_ID] [--project PATH]
  foundry provider cancel|reconcile TASK_ID [--project PATH]
`;
}

function parse(arguments_: string[], spec: OptionSpec): { positional: string[]; options: Options } {
  const valueNames = new Set(spec.value ?? []);
  const listNames = new Set(spec.list ?? []);
  const booleanNames = new Set([...(spec.boolean ?? []), 'json']);
  const positional: string[] = [];
  const options: Options = {};
  const addValue = (name: string, value: string): void => {
    if (listNames.has(name)) {
      const previous = options[name];
      options[name] = Array.isArray(previous) ? [...previous, value] : [value];
      return;
    }
    if (name in options) throw new FoundryError(`Repeated option --${name}`);
    options[name] = value;
  };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === undefined) continue;
    if (argument === '--') throw new FoundryError('Unsupported argument --');
    if (!argument.startsWith('--')) {
      positional.push(argument);
      continue;
    }
    const equals = argument.indexOf('=');
    const name = equals > 2 ? argument.slice(2, equals) : argument.slice(2);
    const inline = equals > 2 ? argument.slice(equals + 1) : null;
    if (!name) throw new FoundryError('Unsupported empty option name');
    if (booleanNames.has(name)) {
      if (inline !== null) throw new FoundryError(`--${name} is a flag and takes no value`);
      if (name in options) throw new FoundryError(`Repeated option --${name}`);
      options[name] = true;
      continue;
    }
    if (!valueNames.has(name) && !listNames.has(name)) {
      throw new FoundryError(`Unknown option --${name} for this command. Use --help.`);
    }
    if (inline !== null) {
      if (!inline) throw new FoundryError(`Missing value for --${name}`);
      addValue(name, inline);
      continue;
    }
    const next = arguments_[index + 1];
    if (next === undefined || next.startsWith('--')) throw new FoundryError(`Missing value for --${name}`);
    addValue(name, next);
    index += 1;
  }
  const allowed = spec.positional ?? 0;
  if (positional.length > allowed) {
    throw new FoundryError(`Unexpected argument ${String(positional[allowed])}. Use --help.`);
  }
  return { positional, options };
}

function stringOption(options: Options, name: string, fallback?: string): string | undefined {
  const value = options[name];
  if (typeof value !== 'string') return fallback;
  return value;
}

function stringListOption(options: Options, name: string): string[] | undefined {
  const value = options[name];
  if (Array.isArray(value)) return value;
  return typeof value === 'string' ? [value] : undefined;
}

function requiredOption(options: Options, name: string): string {
  const value = stringOption(options, name);
  if (!value) throw new FoundryError(`Missing --${name}`);
  return value;
}

function rootOption(options: Options): string {
  return stringOption(options, 'project', process.cwd()) ?? process.cwd();
}

function output(value: unknown, json = false): void {
  writeResult(value, json);
}

async function runLifecycleCommand(
  command: 'verify' | 'complete',
  root: string,
  json: boolean,
): Promise<number> {
  try {
    const before = command === 'complete' ? await status(root) : null;
    const exitCode = command === 'verify' ? await verify(root) : await complete(root);
    const current = await status(root);
    const active = before?.active && typeof before.active === 'object'
      ? before.active as JsonRecord
      : null;
    output({
      command,
      status: exitCode === 0 ? command === 'complete' ? 'completed' : 'verified' : 'failed',
      exit_code: exitCode,
      ...(command === 'complete' ? { completed_run_id: active?.run_id ?? null } : {}),
      result: current,
    }, json);
    return exitCode;
  } catch (error) {
    if (!json) throw error;
    const exitCode = error instanceof FoundryError ? 2 : 1;
    output({
      command,
      status: 'failed',
      exit_code: exitCode,
      error: error instanceof Error ? error.message : String(error),
    }, true);
    return exitCode;
  }
}

const PROJECT_OPTION = ['project'] as const;

const WORKFLOW_SPECS: Record<string, OptionSpec> = {
  guide: {
    value: [...PROJECT_OPTION, 'request', 'intent', 'complexity', 'surface'],
    list: ['requires', 'available'],
    positional: 1,
  },
  context: { value: [...PROJECT_OPTION, 'id'], positional: 1 },
  gate: { value: [...PROJECT_OPTION, 'stage'], positional: 1 },
  record: { value: [...PROJECT_OPTION, 'file'], positional: 1 },
  feedback: { value: [...PROJECT_OPTION, 'file'], positional: 1 },
};

const PROVIDER_SPECS: Record<string, OptionSpec> = {
  '': { value: [...PROJECT_OPTION], positional: 0 },
  status: { value: [...PROJECT_OPTION], positional: 2 },
  cancel: { value: [...PROJECT_OPTION, 'task-id'], positional: 2 },
  reconcile: { value: [...PROJECT_OPTION, 'task-id'], boolean: ['acknowledge-stopped'], positional: 2 },
  run: {
    value: [...PROJECT_OPTION, 'task-id', 'request', 'adapter', 'prompt', 'billing', 'kind', 'model', 'reasoning'],
    boolean: ['confirmed', 'allow-api', 'acknowledge-posthoc-cost'],
    positional: 2,
  },
};

function action(arguments_: string[]): string {
  const first = arguments_[0];
  return first && !first.startsWith('--') ? first : '';
}

async function workflowCommand(arguments_: string[]): Promise<number> {
  const requested = action(arguments_);
  const spec = WORKFLOW_SPECS[requested];
  if (!spec) throw new FoundryError('Usage: foundry work workflow guide|context|gate|record|feedback');
  const { options } = parse(arguments_, spec);
  const root = rootOption(options);
  if (requested === 'guide') {
    const guidance = await guide(
      root,
      stringOption(options, 'request'),
      stringOption(options, 'intent'),
      stringOption(options, 'complexity'),
      stringOption(options, 'surface'),
      stringListOption(options, 'requires'),
      stringListOption(options, 'available'),
    );
    if (options.json === true) {
      output(guidance, true);
    } else {
      const current = guidance.current as Record<string, unknown>;
      const next = guidance.next as Record<string, unknown>;
      const userNeeded = (guidance.user_needed as Record<string, unknown>[])
        .map((item) => `${String(item.kind)}: ${String(item.action)}`)
        .join('; ') || 'none';
      output({
        request: guidance.request || 'unspecified',
        intent: current.intent,
        complexity: current.complexity,
        surface: current.surface,
        next_stage: next.stage,
        next_action: next.action,
        next_reason: next.reason,
        user_needed: userNeeded,
      }, false);
    }
  } else if (requested === 'context') {
    const result = await context(root);
    const id = stringOption(options, 'id');
    if (id) {
      const records = (result.records as Record<string, unknown>[]).filter((item) => item.id === id);
      if (!records.length) throw new FoundryError(`Unknown record ${id}`);
      result.records = records;
    }
    output(result, options.json === true);
  }
  else if (requested === 'gate') {
    const result = await gate(root, stringOption(options, 'stage'));
    output(result, options.json === true);
    return result.status === 'pass' ? 0 : 1;
  } else {
    const file = within(root, normalizeLocalPath(root, requiredOption(options, 'file')));
    const payload = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
    if (requested === 'feedback' && payload.kind !== 'feedback') throw new FoundryError('feedback accepts only a feedback record');
    output(await record(root, payload), options.json === true);
  }
  return 0;
}

async function providersCommand(arguments_: string[]): Promise<number> {
  const requested = action(arguments_);
  const spec = PROVIDER_SPECS[requested];
  if (!spec) throw new FoundryError('Usage: foundry provider [run|status|cancel|reconcile]');
  const { positional, options } = parse(arguments_, spec);
  const root = rootOption(options);
  if (!requested) {
    const adapters = await registry(root);
    output(Object.fromEntries(await Promise.all(Object.entries(adapters)
      .map(async ([name, adapter]) => [name, await inspectAdapter(root, adapter)]))), options.json === true);
    return 0;
  }
  if (requested === 'status') {
    output(await providerStatus(root, positional[1]), options.json === true);
    return 0;
  }
  const taskId = positional[1] ?? stringOption(options, 'task-id');
  if (requested === 'cancel') {
    output(await cancel(root, taskId ?? requiredOption(options, 'task-id')), options.json === true);
    return 0;
  }
  if (requested === 'reconcile') {
    output(await reconcile(root, taskId ?? requiredOption(options, 'task-id'), options['acknowledge-stopped'] === true), options.json === true);
    return 0;
  }
  let request: unknown;
  if (options.request !== undefined) {
    const file = within(root, normalizeLocalPath(root, requiredOption(options, 'request')));
    try {
      request = JSON.parse(await readFile(file, 'utf8')) as unknown;
    } catch (error) {
      throw new FoundryError(`Provider request must be readable JSON: ${(error as Error).message}`, { cause: error });
    }
  } else {
      const adapter = requiredOption(options, 'adapter');
      const prompt = requiredOption(options, 'prompt');
      const mode = stringOption(options, 'billing', 'local') ?? 'local';
      const directRequest: Record<string, unknown> = {
        adapter,
        kind: stringOption(options, 'kind'),
        prompt,
        model: stringOption(options, 'model') ?? null,
        reasoning: stringOption(options, 'reasoning') ?? null,
        billing: {
          mode,
          confirmed: options.confirmed === true,
          allow_api: options['allow-api'] === true,
          acknowledge_posthoc_cost: options['acknowledge-posthoc-cost'] === true,
        },
      };
      Object.keys(directRequest).forEach((key) => directRequest[key] === undefined && delete directRequest[key]);
      request = directRequest;
  }
  const result = await execute(root, request, taskId);
  output(result, options.json === true);
  return result.status === 'completed' ? 0 : result.status === 'canceled' ? 130 : 1;
}

export async function dispatchProjectCommand(arguments_: string[]): Promise<number> {
  const [command, ...rest] = arguments_;
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    process.stdout.write(usage());
    return 0;
  }
  if (command === 'status') {
    const { options } = parse(rest, { value: [...PROJECT_OPTION] });
    output(await status(rootOption(options)), options.json === true);
    return 0;
  }
  if (command === 'start') {
    const { positional, options } = parse(rest, { value: [...PROJECT_OPTION, 'spec'], positional: 1 });
    const state = await start(rootOption(options), positional[0] ?? '', requiredOption(options, 'spec'));
    output(state, options.json === true);
    return 0;
  }
  if (['pause', 'resume'].includes(command)) {
    const { options } = parse(rest, { value: [...PROJECT_OPTION] });
    output(await pauseOrResume(rootOption(options), command === 'pause'), options.json === true);
    return 0;
  }
  if (command === 'verify') {
    const { options } = parse(rest, { value: [...PROJECT_OPTION] });
    return runLifecycleCommand('verify', rootOption(options), options.json === true);
  }
  if (command === 'complete') {
    const { options } = parse(rest, { value: [...PROJECT_OPTION] });
    return runLifecycleCommand('complete', rootOption(options), options.json === true);
  }
  if (command === 'recover') {
    const { options } = parse(rest, { value: [...PROJECT_OPTION] });
    output(await recover(rootOption(options)), options.json === true);
    return 0;
  }
  if (command === 'workflow') return workflowCommand(rest);
  if (command === 'providers') return providersCommand(rest);
  throw new FoundryError(`Unknown command ${command}. Use --help.`);
}
