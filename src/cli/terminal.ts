import readline from 'node:readline';
import type { Readable, Writable } from 'node:stream';

export interface TerminalOptions {
  execute(arguments_: string[]): Promise<number>;
  prompt?: (selected?: string) => string | Promise<string>;
  onExit?: () => Promise<boolean | void>;
  validateSelection?: (identifier: string) => Promise<void>;
  isRunning?: (identifier: string) => Promise<boolean>;
  refreshIntervalMs?: number;
  input?: Readable;
  output?: Writable;
  errorOutput?: Writable;
  terminal?: boolean;
}

const HELP = [
  '/help       show this help',
  '/projects   list projects',
  '/new        create a project (provide NAME, --idea and --adapter)',
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
  let closePromise: Promise<void> | undefined;
  let refreshTimer: NodeJS.Timeout | undefined;
  let refreshing = false;
  let currentPrompt: string | undefined;
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const errorOutput = options.errorOutput ?? process.stderr;
  const terminal = readline.createInterface({
    input,
    output,
    terminal: options.terminal ?? Boolean(input === process.stdin && output === process.stdout
      && process.stdin.isTTY && process.stdout.isTTY),
  });
  const stopRefresh = (): void => {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = undefined;
  };
  const close = (): Promise<void> => {
    if (closePromise) return closePromise;
    exiting = true;
    stopRefresh();
    terminal.close();
    closePromise = (async () => {
      try {
        const confirmed = await options.onExit?.();
        if (confirmed === false) {
          errorOutput.write('Foundry: worker shutdown was not confirmed; recovery is required.\n');
          lastCode = 1;
        }
      } catch (error) {
        errorOutput.write(`Foundry: ${error instanceof Error ? error.message : String(error)}\n`);
        lastCode = 1;
      }
    })();
    return closePromise;
  };
  const promptText = async (): Promise<string> => (
    await options.prompt?.(selected) ?? (selected ? `foundry[${selected}]> ` : 'foundry> ')
  );
  const prompt = async (preserveCursor = false): Promise<void> => {
    if (exiting || terminalClosed) return;
    currentPrompt = await promptText();
    if (exiting || terminalClosed) return;
    terminal.setPrompt(currentPrompt);
    terminal.prompt(preserveCursor);
  };
  const refreshPrompt = async (): Promise<void> => {
    if (exiting || terminalClosed || refreshing || !selected || !options.isRunning) return;
    refreshing = true;
    try {
      const running = await options.isRunning(selected);
      const nextPrompt = await promptText();
      if (nextPrompt !== currentPrompt && !exiting && !terminalClosed) {
        currentPrompt = nextPrompt;
        terminal.setPrompt(currentPrompt);
        terminal.prompt(true);
      }
      if (!running) stopRefresh();
    } catch {
      stopRefresh();
    } finally {
      refreshing = false;
    }
  };
  const startRefresh = (): void => {
    if (!options.isRunning || refreshTimer || exiting || terminalClosed) return;
    refreshTimer = setInterval(() => { void refreshPrompt(); }, options.refreshIntervalMs ?? 1_000);
    refreshTimer.unref();
    void refreshPrompt();
  };
  const refreshSelection = async (): Promise<void> => {
    if (!selected || !options.isRunning) {
      stopRefresh();
      return;
    }
    if (await options.isRunning(selected)) startRefresh();
    else stopRefresh();
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
  try {
    const initialPrompt = prompt();
    for await (const line of terminal) {
      await initialPrompt;
      if (exiting) break;
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
          await options.validateSelection?.(args[0]);
          selected = args[0];
          output.write(`Selected ${selected}\n`);
          await refreshSelection();
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
          if (command === 'run' && lastCode === 0) startRefresh();
          else if (command === 'stop' || command === 'recover') await refreshSelection();
        } else {
          throw new Error(`Unknown terminal command /${command}; use /help`);
        }
      } catch (error) {
        errorOutput.write(`Foundry: ${error instanceof Error ? error.message : String(error)}\n`);
        lastCode = 2;
      }
      await prompt();
    }
  } finally {
    process.off('SIGTERM', onTerminate);
    stopRefresh();
    await close();
  }
  return lastCode;
}
