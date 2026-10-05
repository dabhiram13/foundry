import readline from 'node:readline';
import type { Readable, Writable } from 'node:stream';

export interface TerminalOptions {
  execute(arguments_: string[]): Promise<number>;
  prompt?: (selected?: string) => string | Promise<string>;
  onExit?: () => Promise<void>;
  input?: Readable;
  output?: Writable;
  errorOutput?: Writable;
  terminal?: boolean;
}

const HELP = [
  '/help       show this help',
  '/projects   list projects',
  '/new        create a project (explicitly provide NAME and --idea)',
  '/use        select a project by ID or slug',
  '/run        run the selected project',
  '/review     review the selected project',
  '/approve    approve the selected displayed revision',
  '/stop       stop the selected project',
  '/recover    recover the selected project',
  '/configure  configure the selected project',
  '/roles      list available roles',
  '/providers  list available providers',
  '/exit       leave terminal mode',
].join('\n');

function tokens(input: string): string[] {
  const result: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  for (const match of input.matchAll(pattern)) result.push(match[1] ?? match[2] ?? match[3] ?? '');
  return result;
}

export async function runTerminal(options: TerminalOptions): Promise<number> {
  let selected: string | undefined;
  let lastCode = 0;
  let exiting = false;
  let terminalClosed = false;
  let exited = false;
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const errorOutput = options.errorOutput ?? process.stderr;
  const terminal = readline.createInterface({
    input,
    output,
    terminal: options.terminal ?? Boolean(input === process.stdin && output === process.stdout
      && process.stdin.isTTY && process.stdout.isTTY),
  });
  const close = async (): Promise<void> => {
    if (exited) return;
    exited = true;
    terminal.close();
    try {
      await options.onExit?.();
    } catch (error) {
      errorOutput.write(`Foundry: ${error instanceof Error ? error.message : String(error)}\n`);
      lastCode = 1;
    }
  };
  const prompt = async (): Promise<void> => {
    if (exiting || terminalClosed) return;
    terminal.setPrompt(await options.prompt?.(selected) ?? (selected ? `foundry[${selected}]> ` : 'foundry> '));
    terminal.prompt();
  };
  terminal.on('close', () => { terminalClosed = true; });
  terminal.on('SIGINT', () => {
    output.write('\n');
    exiting = true;
    void close();
  });
  const onTerminate = (): void => {
    exiting = true;
    void close();
  };
  process.once('SIGTERM', onTerminate);
  output.write(`${HELP}\n`);
  await prompt();
  for await (const line of terminal) {
    const input = line.trim();
    if (!input) {
      await prompt();
      continue;
    }
    if (!input.startsWith('/')) {
      output.write('Use an explicit slash command; freeform input is not executed.\n');
      await prompt();
      continue;
    }
    const [command, ...args] = tokens(input.slice(1));
    try {
      if (command === 'help') output.write(`${HELP}\n`);
      else if (command === 'exit') {
        await close();
        break;
      } else if (command === 'use') {
        if (!args[0]) throw new Error('/use requires a project ID or slug');
        selected = args[0];
        output.write(`Selected ${selected}\n`);
      } else if (command === 'projects') {
        lastCode = await options.execute(['list']);
      } else if (command === 'new') {
        lastCode = await options.execute(['new', ...args]);
      } else if (command === 'roles' || command === 'providers') {
        lastCode = await options.execute([
          command,
          ...(command === 'providers' && selected ? [selected] : []),
          ...args,
        ]);
      } else if (['run', 'review', 'approve', 'stop', 'recover', 'configure'].includes(command ?? '')) {
        if (!selected) throw new Error(`/${command} requires a selected project; use /use first`);
        lastCode = await options.execute([command!, selected, ...args]);
      } else {
        throw new Error(`Unknown terminal command /${command}; use /help`);
      }
    } catch (error) {
      errorOutput.write(`Foundry: ${error instanceof Error ? error.message : String(error)}\n`);
      lastCode = 2;
    }
    await prompt();
  }
  await close();
  process.off('SIGTERM', onTerminate);
  return lastCode;
}
