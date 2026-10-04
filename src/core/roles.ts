import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { FoundryError, within } from './fs.js';

const rolePolicySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  sandbox: z.enum(['read-only', 'workspace-write']),
  instructions: z.string().min(1),
}).strict();

const rolesFileSchema = z.object({
  schema_version: z.literal(1),
  roles: z.array(rolePolicySchema).min(1).max(256),
}).strict().superRefine((document, context) => {
  const names = document.roles.map((role) => role.name);
  if (new Set(names).size !== names.length) {
    context.addIssue({ code: 'custom', message: 'Role names must be unique', path: ['roles'] });
  }
});

export type RolePolicy = z.infer<typeof rolePolicySchema>;

export async function loadRoles(root: string): Promise<readonly RolePolicy[]> {
  const file = within(root, '.foundry/roles.json');
  try {
    const raw = JSON.parse(await readFile(file, 'utf8')) as unknown;
    return rolesFileSchema.parse(raw).roles;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new FoundryError(`Invalid neutral role catalog: ${error.issues.map((issue) => issue.message).join('; ')}`, { cause: error });
    }
    throw new FoundryError(`Cannot load neutral role catalog: ${(error as Error).message}`, { cause: error });
  }
}

export async function roleByName(root: string, name: string): Promise<RolePolicy> {
  const role = (await loadRoles(root)).find((candidate) => candidate.name === name);
  if (!role) throw new FoundryError(`Unknown role: ${name}`);
  return role;
}
