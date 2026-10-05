import assert from 'node:assert/strict';
import test from 'node:test';
import { withRequestDeadline } from '../../app/src/request.js';

test('request deadline stops waiting even when the transport ignores cancellation', async () => {
  let signal: AbortSignal | undefined;
  let release: ((value: string) => void) | undefined;
  let attempts = 0;
  const operation = withRequestDeadline(current => {
    attempts++;
    signal = current;
    return new Promise<string>(resolve => { release = resolve; });
  }, 'Check progress before trying again', 10);
  await assert.rejects(operation, /Check progress/);
  assert.equal(attempts, 1);
  assert.equal(signal?.aborted, true);
  release?.('late response');
  assert.equal(await withRequestDeadline(async () => 'current response', 'timeout'), 'current response');
});

test('request deadline preserves immediate errors and does not abort successful requests', async () => {
  let signal: AbortSignal | undefined;
  assert.equal(await withRequestDeadline(async current => {
    signal = current;
    return 'saved';
  }, 'timeout', 10), 'saved');
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(signal?.aborted, false);
  await assert.rejects(withRequestDeadline(async () => { throw new Error('invalid revision'); }, 'timeout'), /invalid revision/);
});
