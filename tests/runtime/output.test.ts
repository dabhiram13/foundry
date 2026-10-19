import assert from 'node:assert/strict';
import { test } from 'node:test';
import { render } from '../../src/cli/output.js';

test('absent values use a simple placeholder', () => {
  assert.equal(render({ model: null }, false), 'model: -\n');
});

test('human output retains nested lifecycle, check, and task details', () => {
  const output = render({
    status: 'running',
    active: { stage: 'build', role: 'builder' },
    checks: [{ name: 'unit', status: 'passed', tasks: [{ title: 'First task', status: 'done' }] }],
    review: { status: 'ready', findings: [{ id: 'R-1', status: 'clear', detail: 'No blocking findings' }] },
  }, false);

  assert.match(output, /active:\n  stage: build\n  role: builder/);
  assert.match(output, /checks:\n  - unit \(passed\)\n    tasks:\n      - First task \(done\)/);
  assert.match(output, /review:\n  status: ready\n  findings:\n    - R-1 \(clear\)\n      detail: No blocking findings/);
});
