import { z } from 'zod';
import { actorSchema, sessionCommandSchema, sessionErrorCodeSchema, sessionIdSchema } from '../core/session-contract.js';

const query = { id: z.uuid(), sessionId: sessionIdSchema, actor: actorSchema };
export const sessionRequestSchema = z.discriminatedUnion('type', [
  z.strictObject({ id: z.uuid(), type: z.literal('accept'), command: sessionCommandSchema, actor: actorSchema }),
  z.strictObject({ ...query, type: z.literal('get') }),
  z.strictObject({ ...query, type: z.literal('state-at'), revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) }),
  z.strictObject({ ...query, type: z.literal('effects') }),
  z.strictObject({ ...query, type: z.literal('events'), after: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), limit: z.number().int().min(1).max(200) }),
  z.strictObject({ id: z.uuid(), type: z.literal('close') }),
]);
export type SessionRequest = z.infer<typeof sessionRequestSchema>;
export const sessionReplySchema = z.discriminatedUnion('ok', [
  z.strictObject({ id: z.uuid(), ok: z.literal(true), data: z.unknown() }),
  z.strictObject({ id: z.uuid(), ok: z.literal(false), code: sessionErrorCodeSchema }),
]);
export const storageReadySchema = z.discriminatedUnion('ready', [
  z.strictObject({ ready: z.literal(true), schemaVersion: z.literal(1) }),
  z.strictObject({ ready: z.literal(false), code: sessionErrorCodeSchema }),
]);
export const storageWorkerDataSchema = z.strictObject({ directory: z.string().min(1).max(4096) });
