import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readFile, readdir, realpath, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { atomicJson, digest, FoundryError, within, withProcessLock } from './fs.js';
import { actorSchema, sessionCommandSchema, type SessionActor } from './session-contract.js';

const CLAIM = '.foundry/state/managed-session.json';
const GATE = '.foundry/state/workspace-admission.lock';
const ADMISSIONS = '.foundry/state/workspace-admissions';
const createSchema = sessionCommandSchema.options[0];
const rootIdentitySchema = z.strictObject({ pathDigest: z.string().regex(/^[a-f0-9]{64}$/), device: z.string(), inode: z.string() });
export const managedClaimSchema = z.strictObject({
  schemaVersion: z.literal(1), root: rootIdentitySchema, ownerId: z.uuid(),
  create: createSchema,
});
export type ManagedClaim = z.infer<typeof managedClaimSchema>;
type Operation = 'scoped' | 'factory' | 'provider' | 'verify' | 'finishTask' | 'recover' | 'resumeWork';
type Admission = { root: string; gateHeld: boolean; legacy?: boolean; authority?: { sessionId: string; ownerId: string } };
const admission = new AsyncLocalStorage<Admission>();

export function managedCheckEnvironment(root: string): NodeJS.ProcessEnv | undefined {
  if (admission.getStore()?.root !== root || !admission.getStore()?.authority) return undefined;
  return { PATH: process.env.PATH ?? path.dirname(process.execPath), LANG: 'C.UTF-8', TZ: 'UTC' };
}

async function rootIdentity(root: string): Promise<z.infer<typeof rootIdentitySchema>> {
  const canonical = await realpath(root);
  if (canonical !== root) throw new FoundryError('Managed ownership needs the canonical project root');
  const info = await stat(root, { bigint: true });
  return { pathDigest: digest(root), device: String(info.dev), inode: String(info.ino) };
}

export async function readManagedClaim(root: string): Promise<ManagedClaim | null> {
  const filename = within(root, CLAIM);
  const info = await lstat(filename).catch(error => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  });
  if (!info) return null;
  if (!info.isFile() || info.nlink !== 1 || info.size > 32_768 || (info.mode & 0o077) !== 0
    || (process.getuid && info.uid !== process.getuid())) throw new FoundryError('Invalid managed project claim');
  const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const current = await handle.stat();
    if (current.ino !== info.ino || current.dev !== info.dev || current.size !== info.size) throw new FoundryError('Managed project claim changed');
    const buffer = Buffer.alloc(32_769);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > 32_768) throw new FoundryError('Invalid managed project claim');
    const claim = managedClaimSchema.parse(JSON.parse(buffer.subarray(0, bytesRead).toString('utf8')));
    const identity = await rootIdentity(root);
    if (JSON.stringify(claim.root) !== JSON.stringify(identity)) throw new FoundryError('Managed project claim belongs to another root');
    return claim;
  } finally { await handle.close(); }
}

export async function assertNoManagedClaim(root: string): Promise<void> {
  if (await readManagedClaim(root)) throw new FoundryError('A managed session owns this project; inspect it before changing work');
}

export async function withWorkspaceAdmission<T>(root: string, action: () => Promise<T>): Promise<T> {
  const current = admission.getStore();
  if (current?.root === root && current.gateHeld) return action();
  return withProcessLock(within(root, GATE), () => admission.run({ root, gateHeld: true }, action));
}

export async function withWorkspaceMutation<T>(root: string, operation: Operation, action: () => Promise<T>): Promise<T> {
  const current = admission.getStore();
  if (current?.root === root && current.legacy) return action();
  const permit = await withWorkspaceAdmission(root, async () => {
    const claim = await readManagedClaim(root);
    if (claim) {
      const authority = admission.getStore()?.authority;
      if (!authority || authority.sessionId !== claim.create.sessionId || authority.ownerId !== claim.ownerId
        || !['verify', 'finishTask', 'recover', 'resumeWork'].includes(operation)) {
        throw new FoundryError('A managed session owns this project; inspect it before changing work');
      }
      return null;
    }
    for (const entry of await inspectWorkspaceAdmissions(root)) {
      try { process.kill(entry.pid, 0); }
      catch { throw new FoundryError('Unresolved workspace admissions need inspection before changing work'); }
    }
    const relative = `${ADMISSIONS}/${randomUUID()}.json`;
    await atomicJson(root, relative, { schemaVersion: 1, pid: process.pid, operation });
    return relative;
  });
  if (!permit) return action();
  try { return await admission.run({ root, gateHeld: false, legacy: true }, action); }
  finally { await rm(within(root, permit)); }
}

export async function inspectWorkspaceAdmissions(root: string): Promise<Array<{ id: string; digest: string; pid: number }>> {
  const names = await readdir(within(root, ADMISSIONS)).catch(error => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  });
  return Promise.all(names.map(async name => {
    const id = z.uuid().parse(name.replace(/\.json$/, ''));
    if (name !== `${id}.json`) throw new FoundryError('Invalid workspace admission');
    const filename = within(root, `${ADMISSIONS}/${name}`);
    const info = await lstat(filename);
    if (!info.isFile() || info.nlink !== 1 || info.size > 1024) throw new FoundryError('Invalid workspace admission');
    const bytes = await readFile(filename);
    const value = z.strictObject({ schemaVersion: z.literal(1), pid: z.number().int().positive(), operation: z.enum(['scoped', 'factory', 'provider', 'verify', 'finishTask', 'recover', 'resumeWork']) }).parse(JSON.parse(bytes.toString('utf8')));
    return { id, digest: digest(bytes), pid: value.pid };
  }));
}

export async function reconcileWorkspaceAdmission(root: string, actor: SessionActor, input: unknown): Promise<void> {
  if (actorSchema.parse(actor).kind !== 'inspector') throw new FoundryError('Workspace admission reconciliation requires inspection');
  const acknowledgement = z.strictObject({ id: z.uuid(), digest: z.string().regex(/^[a-f0-9]{64}$/), resourcesStopped: z.literal(true), effectsKnown: z.literal(true) }).parse(input);
  await withWorkspaceAdmission(root, async () => {
    await assertNoManagedClaim(root);
    const entry = (await inspectWorkspaceAdmissions(root)).find(item => item.id === acknowledgement.id);
    if (!entry || entry.digest !== acknowledgement.digest) throw new FoundryError('Workspace admission changed');
    try { process.kill(entry.pid, 0); throw new FoundryError('Workspace admission still has a live owner'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
    await rm(within(root, `${ADMISSIONS}/${entry.id}.json`));
  });
}

export async function reserveManagedProject(root: string, ownerId: string, create: ManagedClaim['create']): Promise<ManagedClaim> {
  if (admission.getStore()?.root !== root || !admission.getStore()?.gateHeld) throw new FoundryError('Managed reservation requires project admission');
  await assertNoManagedClaim(root);
  const permits = await readdir(within(root, ADMISSIONS)).catch(error => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  });
  if (permits.length) throw new FoundryError('Unresolved workspace admissions need inspection before managed work');
  const claim = managedClaimSchema.parse({ schemaVersion: 1, root: await rootIdentity(root), ownerId, create });
  await atomicJson(root, CLAIM, claim);
  const directory = await open(path.dirname(within(root, CLAIM)), constants.O_RDONLY);
  try { await directory.sync(); } finally { await directory.close(); }
  return claim;
}

export async function withManagedProject<T>(root: string, sessionId: string, ownerId: string, action: (claim: ManagedClaim) => Promise<T>): Promise<T> {
  return withWorkspaceAdmission(root, async () => {
    const claim = await readManagedClaim(root);
    if (!claim || claim.create.sessionId !== sessionId || claim.ownerId !== ownerId) throw new FoundryError('Managed project ownership does not match');
    return admission.run({ root, gateHeld: true, authority: { sessionId, ownerId } }, () => action(claim));
  });
}

export async function releaseManagedProject(root: string, claim: ManagedClaim): Promise<void> {
  const authority = admission.getStore()?.authority;
  if (admission.getStore()?.root !== root || authority?.sessionId !== claim.create.sessionId || authority.ownerId !== claim.ownerId
    || JSON.stringify(await readManagedClaim(root)) !== JSON.stringify(claim)) throw new FoundryError('Managed project ownership changed');
  await rm(within(root, CLAIM));
  const directory = await open(path.dirname(within(root, CLAIM)), constants.O_RDONLY);
  try { await directory.sync(); } finally { await directory.close(); }
}
