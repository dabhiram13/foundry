import { withWorkspaceMutation } from '../../src/core/workspace-ownership.js';

void withWorkspaceMutation(process.argv[2]!, 'provider', async () => {
  process.stdout.write('admitted\n');
  await new Promise<void>(() => { setInterval(() => {}, 1000); });
});
