import { z } from 'zod';
import { FoundryError } from './fs.js';

const ENVIRONMENT_NAME = /^[A-Z_][A-Z0-9_]{0,127}$/;
const RESERVED_ENVIRONMENT = /^(?:PATH|HOME|USER|SHELL|TMPDIR|LANG|TZ|NODE_OPTIONS|OPENCODE_.*|FOUNDRY_.*|XDG_.*)$/;

/** Names an owner-held secret without containing it. Foundry reads the value only for the selected connection. */
export const credentialReferenceSchema = z.strictObject({
  kind: z.literal('env'),
  name: z.string().regex(ENVIRONMENT_NAME).refine(value => !RESERVED_ENVIRONMENT.test(value), 'Reserved environment name'),
});
export type CredentialReference = z.infer<typeof credentialReferenceSchema>;

/** Reads only the referenced variable. The value is never returned to callers that report or persist state. */
export function resolveCredential(reference: CredentialReference, source: NodeJS.ProcessEnv = process.env): string {
  const parsed = credentialReferenceSchema.parse(reference);
  const value = source[parsed.name];
  if (typeof value !== 'string' || value.length < 8 || value.length > 4096 || /[\s\0]/.test(value)) {
    throw new FoundryError(`Credential reference ${parsed.name} is not set to a usable value`);
  }
  return value;
}
