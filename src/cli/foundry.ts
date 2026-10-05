import path from 'node:path';
import { FoundryError } from '../core/fs.js';
import { projectRunExitCode } from './run-exit-code.js';
import {
  ProjectService, type ConfigureProjectOptions, type FactoryRoleMap,
} from '../core/projects.js';
import { startHttpServer } from '../transports/http.js';
import { startMcpServer } from '../transports/mcp.js';

type JsonRecord = Record<string, unknown>;

interface Parsed {
  positionals: string[];
  values: Record<string, string>;
  lists: Record<string, string[]>;
  flags: Set<string>;
}

const VALUE_OPTIONS = new Set([
  'adapter', 'billing', 'idea', 'model', 'port', 'products-dir', 'reasoning', 'revision', 'role',
]);
const FLAG_OPTIONS = new Set(['confirmed', 'json', 'no-browser', 'revoke-consent']);

function usage(): string {
  return [
    'Usage: ./foundry typed COMMAND [--products-dir DIR] [--json]',
    '',
    'Commands:',
    '  new NAME --idea TEXT [--adapter NAME]',
    '  list',
    '  status PROJECT',
    '  configure PROJECT [--adapter NAME] [--billing local|subscription] [--confirmed|--revoke-consent] [--role STAGE=NAME]',
    '  run PROJECT',
    '  review PROJECT',
    '  approve PROJECT --revision HASH',
    '  stop PROJECT',
    '  recover PROJECT',
    '  providers [PROJECT]',
    '  ui --port N --no-browser',
    '  mcp',
  ].join('\n') + '\n';
}

function parse(arguments_: string[]): Parsed {
  const parsed: Parsed = { positionals: [], values: {}, lists: {}, flags: new Set() };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (!argument) continue;
    if (!argument.startsWith('--')) {
      parsed.positionals.push(argument);
      continue;
    }
    const equal = argument.indexOf('=');
    const name = (equal === -1 ? argument.slice(2) : argument.slice(2, equal));
    if (!VALUE_OPTIONS.has(name) && !FLAG_OPTIONS.has(name)) {
      throw new FoundryError(`Unknown option --${name}. Use --help.`);
    }
    if (FLAG_OPTIONS.has(name)) {
      if (equal !== -1) throw new FoundryError(`Flag --${name} does not accept a value`);
      parsed.flags.add(name);
      continue;
    }
    const value = equal === -1 ? arguments_[++index] : argument.slice(equal + 1);
    if (!value || value.startsWith('--')) throw new FoundryError(`Option --${name} needs a value`);
    if (name === 'role') {
      (parsed.lists.role ??= []).push(value);
    } else {
      if (parsed.values[name] !== undefined) throw new FoundryError(`Option --${name} may be provided only once`);
      parsed.values[name] = value;
    }
  }
  return parsed;
}

function requirePositional(parsed: Parsed, count: number, command: string): void {
  if (parsed.positionals.length !== count) throw new FoundryError(`Usage: ${usage().split('\n')[0]} (${command} expects ${count} positional argument${count === 1 ? '' : 's'})`);
}

function roleMap(values: string[] | undefined): FactoryRoleMap | undefined {
  if (!values) return undefined;
  const result: FactoryRoleMap = {};
  for (const value of values) {
    const [stage, role, ...extra] = value.split('=');
    if (extra.length || !stage || !role || !['research', 'scope', 'design', 'build', 'verify', 'release'].includes(stage)) {
      throw new FoundryError('Roles must use --role STAGE=ROLE for a known factory stage');
    }
    if (Object.hasOwn(result, stage)) throw new FoundryError(`Only one --role value is allowed for ${stage}`);
    result[stage as keyof FactoryRoleMap] = role;
  }
  return result;
}

function output(value: unknown, json: boolean): void {
  process.stdout.write(`${json ? JSON.stringify(value) : JSON.stringify(value, null, 2)}\n`);
}

function waitForShutdown(close: () => Promise<void>): Promise<number> {
  return new Promise((resolve, reject) => {
    let shuttingDown = false;
    const onSignal = (signal: NodeJS.Signals) => {
      if (shuttingDown) return;
      shuttingDown = true;
      process.removeListener('SIGINT', onInterrupt);
      process.removeListener('SIGTERM', onTerminate);
      void close().then(() => resolve(signal === 'SIGINT' ? 130 : 143), reject);
    };
    const onInterrupt = () => onSignal('SIGINT');
    const onTerminate = () => onSignal('SIGTERM');
    process.once('SIGINT', onInterrupt);
    process.once('SIGTERM', onTerminate);
  });
}

function sourceRoot(): string {
  return path.resolve(path.dirname(process.argv[1] ?? '.'), '../..');
}

function assertOptions(parsed: Parsed, values: string[], flags: string[], command: string): void {
  const allowedValues = new Set([...values, 'products-dir']);
  const allowedFlags = new Set([...flags, 'json']);
  const unknownValue = Object.keys(parsed.values).find((name) => !allowedValues.has(name));
  const unknownList = Object.keys(parsed.lists).find((name) => !values.includes(name));
  const unknownFlag = [...parsed.flags].find((name) => !allowedFlags.has(name));
  if (unknownValue) throw new FoundryError(`Option --${unknownValue} is not valid for ${command}`);
  if (unknownList) throw new FoundryError(`Option --${unknownList} is not valid for ${command}`);
  if (unknownFlag) throw new FoundryError(`Option --${unknownFlag} is not valid for ${command}`);
}

async function command(arguments_: string[]): Promise<number> {
  if (!arguments_.length || arguments_[0] === '--help' || arguments_[0] === '-h' || arguments_[0] === 'help') {
    process.stdout.write(usage());
    return 0;
  }
  const commandName = arguments_[0];
  if (!commandName || commandName.startsWith('--')) throw new FoundryError('A typed command is required. Use --help.');
  const parsed = parse(arguments_.slice(1));
  const json = parsed.flags.has('json');
  if (commandName === 'ui') {
    assertOptions(parsed, ['port'], ['no-browser'], commandName);
    requirePositional(parsed, 0, commandName);
    const port = parsed.values.port ? Number(parsed.values.port) : 4321;
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new FoundryError('UI port must be an integer from 1 to 65535');
    const handle = await startHttpServer(new ProjectService(sourceRoot(), parsed.values['products-dir']), {
      port,
      openBrowser: !parsed.flags.has('no-browser'),
    });
    return waitForShutdown(handle.close);
  }
  if (commandName === 'mcp') {
    assertOptions(parsed, [], [], commandName);
    requirePositional(parsed, 0, commandName);
    await startMcpServer(new ProjectService(sourceRoot(), parsed.values['products-dir']));
    return 0;
  }
  const service = new ProjectService(sourceRoot(), parsed.values['products-dir']);
  let result: unknown;
  let commandExitCode = 0;
  if (commandName === 'new') {
    assertOptions(parsed, ['idea', 'adapter'], [], commandName);
    requirePositional(parsed, 1, commandName);
    if (!parsed.values.idea) throw new FoundryError('new requires --idea TEXT');
    result = await service.create({
      name: parsed.positionals[0]!,
      idea: parsed.values.idea,
      adapter: parsed.values.adapter,
      model: parsed.values.model ?? null,
      reasoning: parsed.values.reasoning ?? null,
    });
  } else if (commandName === 'list') {
    assertOptions(parsed, [], [], commandName);
    requirePositional(parsed, 0, commandName);
    result = await service.list();
  } else if (commandName === 'status') {
    assertOptions(parsed, [], [], commandName);
    requirePositional(parsed, 1, commandName);
    result = await service.status(parsed.positionals[0]!);
  } else if (commandName === 'configure') {
    assertOptions(parsed, ['adapter', 'billing', 'model', 'reasoning', 'role'], ['confirmed', 'revoke-consent'], commandName);
    requirePositional(parsed, 1, commandName);
    if (parsed.values.billing && !['local', 'subscription'].includes(parsed.values.billing)) {
      throw new FoundryError('--billing must be local or subscription');
    }
    if (parsed.flags.has('confirmed') && parsed.flags.has('revoke-consent')) {
      throw new FoundryError('--confirmed and --revoke-consent cannot be combined');
    }
    const options: ConfigureProjectOptions = {
      adapter: parsed.values.adapter,
      model: parsed.values.model,
      reasoning: parsed.values.reasoning,
      billing: parsed.values.billing as 'local' | 'subscription' | undefined,
      confirmed: parsed.flags.has('confirmed') ? true : parsed.flags.has('revoke-consent') ? false : undefined,
      factory_roles: roleMap(parsed.lists.role),
    };
    result = await service.configure(parsed.positionals[0]!, options);
  } else if (commandName === 'run') {
    assertOptions(parsed, [], [], commandName);
    requirePositional(parsed, 1, commandName);
    const runResult = await service.run(parsed.positionals[0]!);
    result = runResult;
    commandExitCode = projectRunExitCode(runResult.status);
  } else if (commandName === 'review') {
    assertOptions(parsed, [], [], commandName);
    requirePositional(parsed, 1, commandName);
    result = await service.review(parsed.positionals[0]!);
  } else if (commandName === 'approve') {
    assertOptions(parsed, ['revision'], [], commandName);
    requirePositional(parsed, 1, commandName);
    if (!parsed.values.revision) throw new FoundryError('approve requires --revision HASH');
    result = await service.approve(parsed.positionals[0]!, parsed.values.revision);
  } else if (commandName === 'stop') {
    assertOptions(parsed, [], [], commandName);
    requirePositional(parsed, 1, commandName);
    result = await service.stop(parsed.positionals[0]!);
  } else if (commandName === 'recover') {
    assertOptions(parsed, [], [], commandName);
    requirePositional(parsed, 1, commandName);
    result = await service.recover(parsed.positionals[0]!);
  } else if (commandName === 'providers') {
    if (parsed.positionals.length > 1) throw new FoundryError('providers accepts at most one project');
    assertOptions(parsed, [], [], commandName);
    result = await service.providers(parsed.positionals[0]);
  } else {
    throw new FoundryError(`Unknown typed command ${commandName}. Use --help.`);
  }
  output(result, json);
  return commandExitCode;
}

export async function main(arguments_ = process.argv.slice(2)): Promise<number> {
  return command(arguments_);
}

main().then((code) => { process.exitCode = code; }).catch((error: unknown) => {
  process.stderr.write(`Foundry: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = error instanceof FoundryError ? 2 : 1;
});
