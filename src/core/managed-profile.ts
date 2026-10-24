import path from 'node:path';
import { z } from 'zod';

const absolute = z.string().min(1).max(4096).refine(value => path.isAbsolute(value) && !value.includes('\0'));
const name = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/);
export const managedProfileSchema = z.strictObject({
  schemaVersion: z.literal(1), id: z.uuid(), consentRef: z.uuid(),
  boundary: z.literal('trusted-local-disposable'),
  inference: z.literal('local-test-only'),
  binary: absolute, binaryDigest: z.string().regex(/^[a-f0-9]{64}$/),
  provider: z.strictObject({
    id: name, model: name,
    baseURL: z.url().max(2048).refine(value => {
      const url = new URL(value);
      return url.protocol === 'http:' && url.hostname === '127.0.0.1' && !url.username && !url.password
        && !url.search && !url.hash && url.pathname === '/v1' && Number(url.port) > 0;
    }),
  }),
  permissions: z.enum(['read-edit', 'read-edit-shell']),
  maxTurns: z.number().int().min(1).max(3),
  maxSteps: z.number().int().min(1).max(12),
  deadlineMs: z.number().int().min(1000).max(120_000),
});
export type ManagedProfile = z.infer<typeof managedProfileSchema>;
