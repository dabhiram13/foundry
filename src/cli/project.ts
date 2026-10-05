import { readFile } from 'node:fs/promises';
import { FoundryError, normalizeLocalPath, within } from '../core/fs.js';
import { installWorkspace } from '../core/install.js';
import { complete, pauseOrResume, recover, start, status, verify } from '../core/lifecycle.js';
import { context, gate, guide, record } from '../core/workflow.js';
import {
  approveFactory, cancelFactory, configureFactory, factoryHelp, initFactory, recoverFactory,
  reviewFactory, runFactory, statusFactory,
} from '../core/factory.js';
import { cancel, execute, providerStatus, registry, reconcile } from '../runtime/providers.js';

type Options = Record<string, string | boolean | string[]>;

interface OptionSpec {
  value?: readonly string[];
  list?: readonly string[];
  boolean?: readonly string[];
  positional?: number;
}

function usage(): string {
  return `Foundry TypeScript project runtime

Usage:
  project install --source PATH --target PATH [--update] [--recover]
  project status [--project PATH]
  project start SLUG --spec PATH [--project PATH]
  project pause|resume|verify|complete|recover [--project PATH]
  project workflow guide|context|gate|record|feedback [options]
  project providers [--project PATH]
  project providers run --adapter NAME --prompt TEXT [--project PATH] [--billing MODE]
  project providers run --request PATH [--project PATH]
  project providers status [TASK_ID] [--project PATH]
  project providers cancel|reconcile TASK_ID [--project PATH]
  project factory init|configure|status|run|review|approve|cancel|recover [options]
`;
}

function parse(arguments_: string[], spec: OptionSpec): { positional: string[]; options: Options } {
  const valueNames = new Set(spec.value ?? []);
  const listNames = new Set(spec.list ?? []);
  const booleanNames = new Set(spec.boolean ?? []);
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

function output(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
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

const FACTORY_SPECS: Record<string, OptionSpec> = {
  init: {
    value: [...PROJECT_OPTION, 'name', 'idea', 'adapter', 'model', 'reasoning', 'billing'],
    list: ['role'],
    boolean: ['confirmed'],
    positional: 0,
  },
  configure: {
    value: [...PROJECT_OPTION, 'adapter', 'model', 'reasoning', 'billing'],
    list: ['role'],
    boolean: ['confirmed'],
    positional: 0,
  },
  status: { value: [...PROJECT_OPTION], positional: 0 },
  run: { value: [...PROJECT_OPTION], positional: 0 },
  review: { value: [...PROJECT_OPTION, 'stage'], positional: 0 },
  approve: { value: [...PROJECT_OPTION, 'stage', 'revision'], positional: 0 },
  cancel: { value: [...PROJECT_OPTION], positional: 0 },
  recover: { value: [...PROJECT_OPTION], positional: 0 },
};

function action(arguments_: string[]): string {
  const first = arguments_[0];
  return first && !first.startsWith('--') ? first : '';
}

async function workflowCommand(arguments_: string[]): Promise<number> {
  const requested = action(arguments_);
  const spec = WORKFLOW_SPECS[requested];
  if (!spec) throw new FoundryError('Usage: project workflow guide|context|gate|record|feedback');
  const { options } = parse(arguments_, spec);
  const root = rootOption(options);
  if (requested === 'guide') {
    output(await guide(
      root,
      stringOption(options, 'request'),
      stringOption(options, 'intent'),
      stringOption(options, 'complexity'),
      stringOption(options, 'surface'),
      stringListOption(options, 'requires'),
      stringListOption(options, 'available'),
    ));
  } else if (requested === 'context') {
    const result = await context(root);
    const id = stringOption(options, 'id');
    if (id) {
      const records = (result.records as Record<string, unknown>[]).filter((item) => item.id === id);
      if (!records.length) throw new FoundryError(`Unknown record ${id}`);
      result.records = records;
    }
    output(result);
  }
  else if (requested === 'gate') {
    const result = await gate(root, stringOption(options, 'stage'));
    output(result);
    return result.status === 'pass' ? 0 : 1;
  } else {
    const file = within(root, normalizeLocalPath(root, requiredOption(options, 'file')));
    const payload = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
    if (requested === 'feedback' && payload.kind !== 'feedback') throw new FoundryError('feedback accepts only a feedback record');
    output(await record(root, payload));
  }
  return 0;
}

async function providersCommand(arguments_: string[]): Promise<number> {
  const requested = action(arguments_);
  const spec = PROVIDER_SPECS[requested];
  if (!spec) throw new FoundryError('Usage: project providers [run|status|cancel|reconcile]');
  const { positional, options } = parse(arguments_, spec);
  const root = rootOption(options);
  if (!requested) {
    output(await registry(root));
    return 0;
  }
  if (requested === 'status') {
    output(await providerStatus(root, positional[1]));
    return 0;
  }
  const taskId = positional[1] ?? stringOption(options, 'task-id');
  if (requested === 'cancel') {
    output(await cancel(root, taskId ?? requiredOption(options, 'task-id')));
    return 0;
  }
  if (requested === 'reconcile') {
    output(await reconcile(root, taskId ?? requiredOption(options, 'task-id'), options['acknowledge-stopped'] === true));
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
  output(result);
  return result.status === 'completed' ? 0 : result.status === 'canceled' ? 130 : 1;
}

async function factoryCommand(arguments_: string[]): Promise<number> {
  const requested = action(arguments_);
  const first = arguments_[0];
  if (requested === 'help' || first === '--help' || first === '-h' || !arguments_.length) {
    process.stdout.write(`${factoryHelp()}\n`);
    return 0;
  }
  if (!requested) throw new FoundryError('Unknown factory option. Use --help.');
  const spec = FACTORY_SPECS[requested];
  if (!spec) throw new FoundryError('Usage: project factory init|configure|status|run|review|approve|cancel|recover');
  const { options } = parse(arguments_.slice(1), spec);
  const root = rootOption(options);
  if (requested === 'init') {
    output(await initFactory(root, {
      name: requiredOption(options, 'name'),
      idea: requiredOption(options, 'idea'),
      adapter: requiredOption(options, 'adapter'),
      model: stringOption(options, 'model'),
      reasoning: stringOption(options, 'reasoning'),
      billing: stringOption(options, 'billing') as 'local' | 'subscription' | undefined,
      confirmed: options.confirmed === true,
      roles: stringListOption(options, 'role'),
    }));
  } else if (requested === 'configure') {
    output(await configureFactory(root, {
      adapter: stringOption(options, 'adapter'),
      model: stringOption(options, 'model'),
      reasoning: stringOption(options, 'reasoning'),
      billing: stringOption(options, 'billing') as 'local' | 'subscription' | undefined,
      confirmed: options.confirmed === true,
      roles: stringListOption(options, 'role'),
    }));
  } else if (requested === 'status') {
    output(await statusFactory(root));
  } else if (requested === 'run') {
    output(await runFactory(root));
  } else if (requested === 'review') {
    const stage = stringOption(options, 'stage');
    if (stage && stage !== 'plan' && stage !== 'design') throw new FoundryError('Factory review stage must be plan or design');
    output(await reviewFactory(root, stage as 'plan' | 'design' | undefined));
  } else if (requested === 'approve') {
    const stage = requiredOption(options, 'stage');
    if (stage !== 'plan' && stage !== 'design') throw new FoundryError('Factory approval stage must be plan or design');
    output(await approveFactory(root, stage, requiredOption(options, 'revision')));
  } else if (requested === 'cancel') {
    output(await cancelFactory(root));
  } else {
    output(await recoverFactory(root));
  }
  return 0;
}

export async function main(arguments_ = process.argv.slice(2)): Promise<number> {
  const [command, ...rest] = arguments_;
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    process.stdout.write(usage());
    return 0;
  }
  if (command === 'install') {
    const { options } = parse(rest, { value: ['source', 'target'], boolean: ['update', 'recover'] });
    output(await installWorkspace(
      requiredOption(options, 'source'),
      requiredOption(options, 'target'),
      options.update === true,
      options.recover === true,
    ));
    return 0;
  }
  if (command === 'status') {
    const { options } = parse(rest, { value: [...PROJECT_OPTION] });
    output(await status(rootOption(options)));
    return 0;
  }
  if (command === 'start') {
    const { positional, options } = parse(rest, { value: [...PROJECT_OPTION, 'spec'], positional: 1 });
    const state = await start(rootOption(options), positional[0] ?? '', requiredOption(options, 'spec'));
    output(state);
    return 0;
  }
  if (['pause', 'resume'].includes(command)) {
    const { options } = parse(rest, { value: [...PROJECT_OPTION] });
    output(await pauseOrResume(rootOption(options), command === 'pause'));
    return 0;
  }
  if (command === 'verify') {
    const { options } = parse(rest, { value: [...PROJECT_OPTION] });
    return verify(rootOption(options));
  }
  if (command === 'complete') {
    const { options } = parse(rest, { value: [...PROJECT_OPTION] });
    return complete(rootOption(options));
  }
  if (command === 'recover') {
    const { options } = parse(rest, { value: [...PROJECT_OPTION] });
    output(await recover(rootOption(options)));
    return 0;
  }
  if (command === 'workflow') return workflowCommand(rest);
  if (command === 'providers') return providersCommand(rest);
  if (command === 'factory') return factoryCommand(rest);
  throw new FoundryError(`Unknown command ${command}. Use --help.`);
}

main().then((code) => { process.exitCode = code; }).catch((error: unknown) => {
  process.stderr.write(`Foundry: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = error instanceof FoundryError ? 2 : 1;
});
