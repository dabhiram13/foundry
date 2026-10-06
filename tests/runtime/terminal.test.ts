import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PassThrough, Readable, Writable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { runTerminal } from '../../src/cli/terminal.js';

test('first-project guide commands route through the terminal with a selected project', async () => {
  const guide = await readFile('docs/GETTING-STARTED.md', 'utf8');
  const lines = [...guide.matchAll(/```text\n([\s\S]*?)\n```/g)]
    .flatMap(([, block]) => block!.split('\n'));
  const commands: string[][] = [];
  const code = await runTerminal({
    input: Readable.from([...lines, '/exit'].map((line) => `${line}\n`)),
    output: new Writable({ write(_chunk, _encoding, callback) { callback(); } }),
    terminal: false,
    execute: async (args) => { commands.push(args); return 0; },
    validateSelection: async (identifier) => { assert.equal(identifier, 'reading-list'); },
  });
  assert.equal(code, 0);
  assert.deepEqual(commands, [
    ['providers'],
    ['new', 'reading-list', '--idea', 'Save links and mark them read', '--adapter', 'PROVIDER'],
    ['configure', 'reading-list', '--billing', 'subscription', '--confirmed'],
    ['run', 'reading-list'],
    ['review', 'reading-list'],
    ['approve', 'reading-list'],
    ['run', 'reading-list'],
  ]);
});

test('terminal routes explicit slash commands and rejects freeform execution', async () => {
  const commands: string[][] = [];
  const chunks: string[] = [];
  let closed = 0;
  const input = Readable.from([
    'Do something unsafe\n',
    '/new "Small notes" --idea "Keep owner files safe."\n',
    '/projects\n',
    '/use project-123\n',
    '/run\n',
    '/review\n',
    '/approve\n',
    '/stop\n',
    '/recover\n',
    '/configure --model local-model\n',
    '/roles\n',
    '/providers\n',
    '/exit\n',
  ]);
  const output = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk).toString());
      callback();
    },
  });
  const code = await runTerminal({
    input,
    output,
    terminal: false,
    prompt: (selected) => selected ? `foundry[${selected}]> ` : 'foundry> ',
    execute: async (arguments_) => {
      commands.push(arguments_);
      return 0;
    },
    onExit: async () => { closed += 1; },
  });
  const rendered = chunks.join('');
  assert.equal(code, 0);
  assert.deepEqual(commands, [
    ['new', 'Small notes', '--idea', 'Keep owner files safe.'],
    ['list'],
    ['run', 'project-123'],
    ['review', 'project-123'],
    ['approve', 'project-123'],
    ['stop', 'project-123'],
    ['recover', 'project-123'],
    ['configure', 'project-123', '--model', 'local-model'],
    ['roles'],
    ['providers', 'project-123'],
  ]);
  assert.match(rendered, /freeform input is not executed/);
  assert.equal(closed, 1);
});

test('terminal closes owned work when input ends without an exit command', async () => {
  let closed = 0;
  await runTerminal({
    input: Readable.from([]),
    output: new Writable({ write(_chunk, _encoding, callback) { callback(); } }),
    terminal: false,
    execute: async () => 0,
    onExit: async () => { closed += 1; },
  });
  assert.equal(closed, 1);
});

test('terminal awaits one interrupted shutdown and fails when worker shutdown is unconfirmed', async () => {
  const input = new PassThrough();
  const outputChunks: string[] = [];
  const errorChunks: string[] = [];
  let closed = 0;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      outputChunks.push(Buffer.from(chunk).toString());
      callback();
    },
  });
  const errorOutput = new Writable({
    write(chunk, _encoding, callback) {
      errorChunks.push(Buffer.from(chunk).toString());
      callback();
    },
  });
  const running = runTerminal({
    input,
    output,
    errorOutput,
    terminal: false,
    execute: async () => 0,
    onExit: async () => {
      closed += 1;
      await delay(25);
      return false;
    },
  });

  process.emit('SIGTERM');
  assert.equal(await running, 1);
  assert.equal(closed, 1);
  assert.match(errorChunks.join(''), /worker shutdown was not confirmed/);
});

test('terminal validates selection and refreshes active progress without consuming partial input', async () => {
  const input = new PassThrough();
  const outputChunks: string[] = [];
  const commands: string[][] = [];
  let running = false;
  let stage = 'research';
  const output = new Writable({
    write(chunk, _encoding, callback) {
      outputChunks.push(Buffer.from(chunk).toString());
      callback();
    },
  });
  const terminal = runTerminal({
    input,
    output,
    terminal: false,
    refreshIntervalMs: 10,
    prompt: (selected) => selected ? `foundry[${selected} · ${stage}]> ` : 'foundry> ',
    validateSelection: async (identifier) => {
      if (identifier !== 'project-123') throw new Error('Unknown project');
    },
    isRunning: async () => running,
    execute: async (arguments_) => {
      commands.push(arguments_);
      if (arguments_[0] === 'run') {
        running = true;
        setTimeout(() => { stage = 'build'; }, 25);
        setTimeout(() => { stage = 'verify'; }, 55);
        setTimeout(() => { running = false; }, 85);
      }
      return 0;
    },
    onExit: async () => true,
  });

  input.write('/use project-123\n/run\n');
  await delay(20);
  input.write('draft');
  await delay(100);
  input.write('\n/exit\n');
  await terminal;

  const rendered = outputChunks.join('');
  assert.deepEqual(commands, [['run', 'project-123']]);
  assert.match(rendered, /project-123 · build/);
  assert.match(rendered, /project-123 · verify/);
  assert.match(rendered, /freeform input is not executed/);
});

test('terminal does not dispatch queued commands after a shutdown signal', async () => {
  const commands: string[][] = [];
  let closed = 0;
  await runTerminal({
    input: Readable.from(['/projects\n/projects\n']),
    output: new Writable({ write(_chunk, _encoding, callback) { callback(); } }),
    terminal: false,
    execute: async (arguments_) => {
      commands.push(arguments_);
      process.emit('SIGTERM');
      return 0;
    },
    onExit: async () => { closed += 1; },
  });
  assert.deepEqual(commands, [['list']]);
  assert.equal(closed, 1);
});

test('terminal reports invalid project selections without changing the selection', async () => {
  const errors: string[] = [];
  const commands: string[][] = [];
  const errorOutput = new Writable({
    write(chunk, _encoding, callback) {
      errors.push(Buffer.from(chunk).toString());
      callback();
    },
  });
  await runTerminal({
    input: Readable.from(['/use missing-project\n', '/run\n', '/exit\n']),
    output: new Writable({ write(_chunk, _encoding, callback) { callback(); } }),
    errorOutput,
    terminal: false,
    validateSelection: async () => { throw new Error('Project not found'); },
    execute: async (arguments_) => { commands.push(arguments_); return 0; },
  });
  assert.deepEqual(commands, []);
  assert.match(errors.join(''), /Project not found/);
  assert.match(errors.join(''), /requires a selected project/);
});
