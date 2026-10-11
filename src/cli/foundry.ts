import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { lstat } from 'node:fs/promises';
import path from 'node:path';
import { FoundryError, expandUserPath } from '../core/fs.js';
import { installWorkspace } from '../core/install.js';
import { migrateWorkspace } from '../core/migrate.js';
import {
  ProjectService, type ConfigureProjectOptions,
} from '../core/projects.js';
import { loadRoles } from '../core/roles.js';
import { closeProjectRuns, isProjectRunActive, startProjectRun } from '../runtime/jobs.js';
import { projectRunExitCode } from './run-exit-code.js';
import { dispatchProjectCommand } from './project.js';
import { writeResult } from './output.js';
import { runTerminal } from './terminal.js';

type JsonRecord = Record<string, unknown>;
declare const __FOUNDRY_VERSION__: string;
type Values = Record<string, string | string[] | undefined>;

interface Parsed {
  positionals: string[];
  values: Values;
  flags: Set<string>;
}

interface CommandOptions {
  values?: readonly string[];
  flags?: readonly string[];
  minPositionals: number;
  maxPositionals: number;
}

const VALUE_OPTIONS = new Set([
  'adapter', 'billing', 'idea', 'model', 'products-dir', 'project', 'reasoning', 'revision',
  'role', 'spec', 'source', 'target', 'request', 'task-id', 'stage', 'name', 'providers',
]);
const FLAG_OPTIONS = new Set([
  'apply', 'confirmed', 'dry-run', 'json', 'recover', 'remove', 'revoke-consent', 'update',
]);

export function usage(): string {
  return `Foundry terminal-first runtime

Usage:
  foundry COMMAND [options]
  foundry --version

Commands:
  new NAME --idea TEXT --adapter NAME [--providers FILE]
  list [--products-dir DIR]
  status PROJECT
  configure PROJECT [--adapter NAME] [--billing local|subscription] [--confirmed|--revoke-consent]
  run PROJECT
  review PROJECT
  approve PROJECT --revision HASH
  stop PROJECT
  recover PROJECT
  roles
  providers [PROJECT] [--providers FILE]
  init --project PATH
  migrate --project PATH --dry-run|--apply [--recover]
  mcp --project PATH
  connect opencode --project PATH --dry-run|--apply|--remove
  foundry work start|status|context|review|approve|verify|complete|pause|resume|recover|workflow ...
  foundry provider run|status|cancel|reconcile ...

With no command, an interactive readline terminal opens only on a TTY.
Use --json for one JSON value on stdout.
`;
}

function parse(arguments_: string[]): Parsed {
  const parsed: Parsed = { positionals: [], values: {}, flags: new Set() };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (!argument) continue;
    if (argument === '--') throw new FoundryError('Unsupported argument --');
    if (!argument.startsWith('--')) {
      parsed.positionals.push(argument);
      continue;
    }
    const equal = argument.indexOf('=');
    const name = equal === -1 ? argument.slice(2) : argument.slice(2, equal);
    const inline = equal === -1 ? undefined : argument.slice(equal + 1);
    if (FLAG_OPTIONS.has(name)) {
      if (inline !== undefined) throw new FoundryError(`Flag --${name} does not accept a value`);
      if (parsed.flags.has(name)) throw new FoundryError(`Repeated option --${name}`);
      parsed.flags.add(name);
      continue;
    }
    if (!VALUE_OPTIONS.has(name)) throw new FoundryError(`Unknown option --${name}. Use --help.`);
    const value = inline ?? arguments_[++index];
    if (!value || value.startsWith('--')) throw new FoundryError(`Option --${name} needs a value`);
    if (name === 'role') {
      const previous = parsed.values.role;
      parsed.values.role = [...(Array.isArray(previous) ? previous : previous ? [previous] : []), value];
    } else {
      if (parsed.values[name] !== undefined) throw new FoundryError(`Option --${name} may be provided only once`);
      parsed.values[name] = value;
    }
  }
  return parsed;
}

function value(parsed: Parsed, name: string, fallback?: string): string | undefined {
  const item = parsed.values[name];
  return typeof item === 'string' ? item : fallback;
}

function values(parsed: Parsed, name: string): string[] | undefined {
  const item = parsed.values[name];
  return Array.isArray(item) ? item : typeof item === 'string' ? [item] : undefined;
}

function required(parsed: Parsed, name: string): string {
  const item = value(parsed, name);
  if (!item) throw new FoundryError(`Missing --${name}`);
  return item;
}

function validateCommandOptions(parsed: Parsed, command: string, spec: CommandOptions): void {
  const allowedValues = new Set(spec.values ?? []);
  for (const name of Object.keys(parsed.values)) {
    if (!allowedValues.has(name)) throw new FoundryError(`Option --${name} is not valid for ${command}. Use --help.`);
  }
  const allowedFlags = new Set(['json', ...(spec.flags ?? [])]);
  for (const name of parsed.flags) {
    if (!allowedFlags.has(name)) throw new FoundryError(`Option --${name} is not valid for ${command}. Use --help.`);
  }
  if (parsed.positionals.length < spec.minPositionals) {
    throw new FoundryError(`${command} requires at least ${spec.minPositionals} positional argument${spec.minPositionals === 1 ? '' : 's'}`);
  }
  if (parsed.positionals.length > spec.maxPositionals) {
    throw new FoundryError(`${command} accepts at most ${spec.maxPositionals} positional argument${spec.maxPositionals === 1 ? '' : 's'}`);
  }
  if (value(parsed, 'project') && value(parsed, 'products-dir')) {
    throw new FoundryError('--project and --products-dir cannot be combined');
  }
  if (value(parsed, 'project') && parsed.positionals.length) {
    throw new FoundryError(`${command} does not accept a positional project when --project is provided`);
  }
}

function sourceRoot(): string {
  const executable = realpathSync(process.argv[1] ?? '.');
  const fromExecutable = path.resolve(path.dirname(executable), '../..');
  const candidates = [
    process.env.FOUNDRY_SOURCE_ROOT,
    fromExecutable,
    process.cwd(),
  ].filter((candidate): candidate is string => Boolean(candidate)).map((candidate) => path.resolve(candidate));
  return candidates.find((candidate) => existsSync(path.join(candidate, '.foundry/roles.json'))) ?? candidates[0]!;
}

function projectPath(parsed: Parsed): string | undefined {
  const selected = value(parsed, 'project');
  return selected ? path.resolve(expandUserPath(selected)) : undefined;
}

function runtimeDirectory(root: string): string {
  const installed = path.join(root, '.foundry/runtime');
  return existsSync(path.join(installed, 'foundry-worker.cjs'))
    ? installed : path.join(root, 'dist/runtime');
}

function workspaceIdentifier(project: string): string {
  try {
    const state = JSON.parse(readFileSync(path.join(project, '.foundry/state/factory/controller.json'), 'utf8')) as {
      workspace_id?: unknown;
    };
    if (typeof state.workspace_id === 'string') return state.workspace_id;
  } catch {
    return path.basename(project);
  }
  return path.basename(project);
}

function serviceContext(parsed: Parsed): { service: ProjectService; identifier?: string; project?: string } {
  const root = sourceRoot();
  const project = projectPath(parsed);
  if (!project) return {
    service: new ProjectService(root, value(parsed, 'products-dir'), runtimeDirectory(root)),
  };
  const runtimeDir = existsSync(path.join(project, '.foundry/runtime'))
    ? path.join(project, '.foundry/runtime') : runtimeDirectory(root);
  return {
    service: new ProjectService(root, path.dirname(project), runtimeDir),
    identifier: workspaceIdentifier(project),
    project,
  };
}

function selectedIdentifier(parsed: Parsed, context: { identifier?: string }): string {
  return parsed.positionals[0] ?? context.identifier
    ?? (() => { throw new FoundryError('A project ID or slug is required; use --project PATH or provide PROJECT'); })();
}

function roleMap(entries: string[] | undefined): Record<string, string> | undefined {
  if (!entries) return undefined;
  const result: Record<string, string> = {};
  for (const entry of entries) {
    const separator = entry.indexOf('=');
    if (separator <= 0 || separator === entry.length - 1) throw new FoundryError('--role must be STAGE=NAME');
    result[entry.slice(0, separator)] = entry.slice(separator + 1);
  }
  return result;
}

const terminalServices = new Set<ProjectService>();
const terminalReviews = new Map<string, string>();

function reviewKey(service: ProjectService, identifier: string): string {
  return `${service.productsDir}\0${identifier}`;
}

export async function runCommand(arguments_: string[], terminalMode = false): Promise<number> {
  const [command, ...rest] = arguments_;
  if (command === '--version' || command === '-v') {
    if (rest.length) throw new FoundryError('Version does not accept additional arguments.');
    process.stdout.write(`${__FOUNDRY_VERSION__}\n`);
    return 0;
  }
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    process.stdout.write(usage());
    return 0;
  }
  if (command === 'work') {
    if (!rest.length || rest[0] === '--help' || rest[0] === '-h') {
      process.stdout.write(usage());
      return 0;
    }
    const [workCommand, ...workArgs] = rest;
    if (workCommand === 'provider' || workCommand === 'providers') {
      return dispatchProjectCommand(['providers', ...workArgs]);
    }
    return dispatchProjectCommand([workCommand!, ...workArgs]);
  }
  if (command === 'provider') return dispatchProjectCommand(['providers', ...rest]);
  if (command === 'connect') {
    const [client, ...options] = rest;
    if (client !== 'opencode') throw new FoundryError('The first supported connection is opencode.');
    const parsed = parse(options);
    validateCommandOptions(parsed, command, { values: ['project'], flags: ['dry-run', 'apply', 'remove'], minPositionals: 0, maxPositionals: 0 });
    const modes = ['dry-run', 'apply', 'remove'].filter(mode => parsed.flags.has(mode));
    if (modes.length !== 1) throw new FoundryError('connect requires exactly one of --dry-run, --apply or --remove.');
    const project = projectPath(parsed);
    if (!project) throw new FoundryError('connect requires --project PATH');
    const { connectOpenCode } = await import('../core/connect.js');
    const result = await connectOpenCode(project, realpathSync(process.argv[1]!), modes[0] as 'dry-run' | 'apply' | 'remove');
    if (parsed.flags.has('json')) writeResult(result, true);
    else process.stdout.write(`OpenCode connection ${result.mode}${result.applied ? ' applied' : ''}\nConfig: ${result.config} (mcp.foundry: ${result.configuration_action})\nSkill: ${result.skill} (${result.skill_action})\nCommand: ${result.command.map(part => JSON.stringify(part)).join(' ')}\nNext: ${result.next_action}\n`);
    return 0;
  }
  if (command === 'mcp') {
    if (terminalMode) throw new FoundryError('Run mcp from your coding client, not the interactive terminal.');
    const parsed = parse(rest);
    validateCommandOptions(parsed, command, { values: ['project'], minPositionals: 0, maxPositionals: 0 });
    if (parsed.flags.size) throw new FoundryError('MCP uses protocol stdout; it does not accept flags.');
    const project = projectPath(parsed);
    if (!project) throw new FoundryError('mcp requires --project PATH');
    const { serveMcp } = await import('../runtime/mcp.js');
    await serveMcp(project, __FOUNDRY_VERSION__);
    return 0;
  }
  if (command === 'init') {
    const parsed = parse(rest);
    validateCommandOptions(parsed, command, {
      values: ['project'],
      flags: ['recover', 'update'],
      minPositionals: 0,
      maxPositionals: 0,
    });
    const project = projectPath(parsed);
    if (!project) throw new FoundryError('init requires --project PATH');
    const stats = await lstat(project).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') throw new FoundryError('init requires an existing repository directory', { cause: error });
      throw error;
    });
    if (!stats.isDirectory() || stats.isSymbolicLink()) throw new FoundryError('init requires a regular repository directory');
    const foundryDirectory = path.join(project, '.foundry');
    const foundryInfo = await lstat(foundryDirectory).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (foundryInfo?.isSymbolicLink()) throw new FoundryError('init refuses a symlinked .foundry directory');
    if (!parsed.flags.has('recover')) {
      if (foundryInfo && !existsSync(path.join(foundryDirectory, 'runtime.json'))) {
        throw new FoundryError('Target contains an unmarked Foundry workspace; use migrate explicitly.');
      }
    }
    const result = await installWorkspace(
      sourceRoot(),
      project,
      Boolean(parsed.flags.has('update')),
      Boolean(parsed.flags.has('recover')),
    );
    writeResult(result, parsed.flags.has('json'));
    return 0;
  }
  if (command === 'migrate') {
    const parsed = parse(rest);
    validateCommandOptions(parsed, command, {
      values: ['project'],
      flags: ['apply', 'dry-run', 'recover'],
      minPositionals: 0,
      maxPositionals: 0,
    });
    const dryRun = parsed.flags.has('dry-run');
    const apply = parsed.flags.has('apply');
    const recover = parsed.flags.has('recover');
    if (dryRun === apply) throw new FoundryError('migrate requires exactly one of --dry-run or --apply [--recover]');
    if (recover && !apply) throw new FoundryError('--recover is valid only with --apply');
    const project = projectPath(parsed);
    if (!project) throw new FoundryError('migrate requires --project PATH');
    const stats = await lstat(project).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') throw new FoundryError('migrate requires an existing repository directory', { cause: error });
      throw error;
    });
    if (!stats.isDirectory() || stats.isSymbolicLink()) throw new FoundryError('migrate requires a regular repository directory');
    const mode = dryRun ? 'dry-run' : recover ? 'recover' : 'apply';
    const result = await migrateWorkspace(project, sourceRoot(), mode);
    writeResult(result, parsed.flags.has('json'));
    return 0;
  }

  const parsed = parse(rest);
  const json = parsed.flags.has('json');
  const commandSpecs: Record<string, CommandOptions> = {
    new: {
      values: ['idea', 'adapter', 'model', 'reasoning', 'products-dir', 'providers'],
      minPositionals: 1,
      maxPositionals: 1,
    },
    list: { values: ['products-dir'], minPositionals: 0, maxPositionals: 0 },
    status: { values: ['project', 'products-dir'], minPositionals: 0, maxPositionals: 1 },
    configure: {
      values: ['project', 'products-dir', 'adapter', 'model', 'reasoning', 'billing', 'role'],
      flags: ['confirmed', 'revoke-consent'],
      minPositionals: 0,
      maxPositionals: 1,
    },
    run: { values: ['project', 'products-dir'], minPositionals: 0, maxPositionals: 1 },
    review: { values: ['project', 'products-dir'], minPositionals: 0, maxPositionals: 1 },
    approve: { values: ['project', 'products-dir', 'revision'], minPositionals: 0, maxPositionals: 1 },
    stop: { values: ['project', 'products-dir'], minPositionals: 0, maxPositionals: 1 },
    recover: { values: ['project', 'products-dir'], minPositionals: 0, maxPositionals: 1 },
    roles: { minPositionals: 0, maxPositionals: 0 },
    providers: { values: ['project', 'products-dir', 'providers'], minPositionals: 0, maxPositionals: 1 },
  };
  const commandSpec = commandSpecs[command];
  if (!commandSpec) throw new FoundryError(`Unknown command ${command}. Use --help.`);
  validateCommandOptions(parsed, command, commandSpec);
  const context = serviceContext(parsed);
  const { service } = context;
  let result: unknown;
  let reviewText: string | undefined;
  let exitCode = 0;
  if (command === 'new') {
    result = await service.create({
      name: parsed.positionals[0]!,
      idea: required(parsed, 'idea'),
      adapter: value(parsed, 'adapter'),
      providers: value(parsed, 'providers'),
      model: value(parsed, 'model') ?? null,
      reasoning: value(parsed, 'reasoning') ?? null,
    });
  } else if (command === 'list') {
    result = await service.list();
  } else if (command === 'status') {
    result = await service.status(selectedIdentifier(parsed, context));
  } else if (command === 'configure') {
    const identifier = selectedIdentifier(parsed, context);
    const billing = value(parsed, 'billing');
    if (billing && billing !== 'local' && billing !== 'subscription') throw new FoundryError('--billing must be local or subscription');
    if (parsed.flags.has('confirmed') && parsed.flags.has('revoke-consent')) {
      throw new FoundryError('--confirmed and --revoke-consent cannot be combined');
    }
    const options: ConfigureProjectOptions = {
      adapter: value(parsed, 'adapter'),
      model: value(parsed, 'model'),
      reasoning: value(parsed, 'reasoning'),
      billing: billing as 'local' | 'subscription' | undefined,
      confirmed: parsed.flags.has('confirmed') ? true : parsed.flags.has('revoke-consent') ? false : undefined,
      factory_roles: roleMap(values(parsed, 'role')),
    };
    result = await service.configure(identifier, options);
  } else if (command === 'run') {
    const identifier = selectedIdentifier(parsed, context);
    if (terminalMode) {
      terminalServices.add(service);
      result = await startProjectRun(service, identifier);
    } else {
      result = await service.run(identifier);
      exitCode = projectRunExitCode(String((result as JsonRecord).status ?? 'failed'));
    }
  } else if (command === 'review') {
    const identifier = selectedIdentifier(parsed, context);
    result = await service.review(identifier);
    const review = result as JsonRecord;
    reviewText = `${String(review.label)} — ${String(review.path)}\nRevision: ${String(review.revision)}\n\n${String(review.text)}`;
    if (terminalMode) {
      terminalReviews.set(reviewKey(service, identifier), String(review.revision));
    }
  } else if (command === 'approve') {
    const identifier = selectedIdentifier(parsed, context);
    let revision = value(parsed, 'revision');
    if (terminalMode) {
      const displayed = terminalReviews.get(reviewKey(service, identifier));
      if (!displayed) throw new FoundryError('Review the current document in this terminal before approving it.');
      if (revision && revision !== displayed) throw new FoundryError('Approval must match the revision displayed in this terminal.');
      revision = displayed;
    }
    result = await service.approve(identifier, revision ?? required(parsed, 'revision'));
    if (terminalMode) terminalReviews.delete(reviewKey(service, identifier));
  } else if (command === 'stop') {
    result = await service.stop(selectedIdentifier(parsed, context));
  } else if (command === 'recover') {
    result = await service.recover(selectedIdentifier(parsed, context));
  } else if (command === 'roles') {
    result = (await loadRoles(sourceRoot())).map((role) => ({
      name: role.name, description: role.description, sandbox: role.sandbox,
    }));
  } else if (command === 'providers') {
    result = await service.providers(parsed.positionals[0] ?? context.identifier, value(parsed, 'providers'));
  } else {
    throw new FoundryError(`Unknown command ${command}. Use --help.`);
  }
  if (reviewText !== undefined && !json) process.stdout.write(`${reviewText}\n`);
  else writeResult(result, json);
  return exitCode;
}

export async function main(arguments_ = process.argv.slice(2)): Promise<number> {
  if (Number(process.versions.node.split('.')[0]) < 24) {
    throw new FoundryError(`Foundry requires Node 24 or newer (found ${process.versions.node}).`);
  }
  if (!arguments_.length && process.stdin.isTTY) {
    return runTerminal({
      execute: (arguments__) => runCommand(arguments__, true),
      prompt: async (selected) => {
        if (!selected) return 'foundry> ';
        try {
          const context = serviceContext({ positionals: [], values: {}, flags: new Set() });
          const status = await context.service.status(selected);
          const stage = String(status.stage ?? 'idle');
          const state = String(status.status ?? 'unknown');
          const roles = status.factory_roles && typeof status.factory_roles === 'object'
            ? status.factory_roles as Record<string, unknown> : {};
          const role = roles[stage] ? ` · ${String(roles[stage])}` : '';
          const verification = status.stage_verification && typeof status.stage_verification === 'object'
            ? (status.stage_verification as JsonRecord).build : undefined;
          const tasks = verification && typeof verification === 'object'
            && Array.isArray((verification as JsonRecord).tasks)
            ? ((verification as JsonRecord).tasks as JsonRecord[])
            : [];
          const progress = tasks.slice(-2).map((task) => (
            `${String(task.title ?? 'task')}:${String(task.status ?? 'unknown')}`
          )).join(', ');
          return `foundry[${selected} · ${state}/${stage}${role}${progress ? ` · ${progress}` : ''}]> `;
        } catch {
          return `foundry[${selected}]> `;
        }
      },
      validateSelection: async (identifier) => {
        const context = serviceContext({ positionals: [], values: {}, flags: new Set() });
        await context.service.status(identifier);
      },
      isRunning: async (identifier) => {
        const context = serviceContext({ positionals: [], values: {}, flags: new Set() });
        const status = await context.service.status(identifier);
        return isProjectRunActive(String(status.path))
          || status.status === 'running' || status.status === 'shipping';
      },
      onExit: async () => {
        let confirmed = true;
        for (const service of terminalServices) confirmed = (await closeProjectRuns(service)) && confirmed;
        terminalServices.clear();
        return confirmed;
      },
    });
  }
  return runCommand(arguments_);
}

if (require.main === module || process.env.FOUNDRY_LAUNCHER === '1') {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error: unknown) => {
    process.stderr.write(`Foundry: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = error instanceof FoundryError ? 2 : 1;
  });
}
