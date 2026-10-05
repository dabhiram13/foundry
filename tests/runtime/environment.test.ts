import assert from 'node:assert/strict';
import test from 'node:test';
import { providerEnvironment } from '../../src/runtime/environment.js';

test('providers receive runtime basics, not unrelated credentials or process injection', () => {
  const source = { PATH: '/bin', HOME: '/home/test', SystemRoot: 'C:\\Windows',
    OTHER_API_KEY: 'unrelated', NODE_OPTIONS: '--require=unexpected.cjs', LD_PRELOAD: 'unexpected.so',
    SELECTED_CREDENTIAL: 'selected' };
  assert.deepEqual(providerEnvironment({ name: 'other' }, 'local', source), {
    PATH: source.PATH, HOME: source.HOME, SystemRoot: source.SystemRoot,
  });
  assert.equal(providerEnvironment({ name: 'other', environment: ['SELECTED_CREDENTIAL'] }, 'local', source).SELECTED_CREDENTIAL, 'selected');
});

test('Codex API credentials require the separately validated API billing route', () => {
  const source = { OPENAI_API_KEY: 'first', CODEX_API_KEY: 'second', CODEX_HOME: '/local/codex' };
  assert.deepEqual(providerEnvironment({ name: 'codex' }, 'subscription', source), { CODEX_HOME: source.CODEX_HOME });
  assert.deepEqual(providerEnvironment({ name: 'codex' }, 'api', source), source);
});
