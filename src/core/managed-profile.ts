import path from 'node:path';
import { z } from 'zod';
import { localTestConnectionSchema, remoteConnectionSchema } from './connection-profile.js';

const absolute = z.string().min(1).max(4096).refine(value => path.isAbsolute(value) && !value.includes('\0'));
const common = {
  schemaVersion: z.literal(1), id: z.uuid(), consentRef: z.uuid(),
  boundary: z.literal('trusted-local-disposable'),
  binary: absolute, binaryDigest: z.string().regex(/^[a-f0-9]{64}$/),
  permissions: z.enum(['read-edit', 'read-edit-shell']),
  maxTurns: z.number().int().min(1).max(3),
  maxSteps: z.number().int().min(1).max(12),
  deadlineMs: z.number().int().min(1000).max(120_000),
};
export const localManagedProfileSchema = z.strictObject({
  ...common, inference: z.literal('local-test-only'), provider: localTestConnectionSchema.omit({ mode: true }),
});
export const remoteManagedProfileSchema = z.strictObject({
  ...common, inference: z.literal('consented-remote'), provider: remoteConnectionSchema,
  limits: z.strictObject({ maxRequests: z.number().int().min(1).max(64), maxOutputTokens: z.number().int().min(1).max(32_768) }),
  billing: z.strictObject({ mode: z.literal('api'), dollarCap: z.literal('not-enforced-by-foundry') }),
});
export const managedProfileSchema = z.discriminatedUnion('inference', [localManagedProfileSchema, remoteManagedProfileSchema]);
export type ManagedProfile = z.infer<typeof managedProfileSchema>;
export type RemoteManagedProfile = z.infer<typeof remoteManagedProfileSchema>;
