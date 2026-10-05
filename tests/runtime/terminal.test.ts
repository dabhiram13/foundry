import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { test } from 'node:test';
import { runTerminal } from '../../src/cli/terminal.js';

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
