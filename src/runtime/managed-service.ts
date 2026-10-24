import { randomUUID } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { atomicJson, canonicalJson, digest, FoundryError, withProcessLock } from '../core/fs.js';
import { requireRuntimeWorkspace } from '../core/lifecycle.js';
import { managedProfileSchema } from '../core/managed-profile.js';
import { controlManagedTask, createManagedOpenCodeTask, dispatchManagedOpenCodeTurn, publishManagedTask, recoverManagedCreation,
  recoverManagedOpenCodeTurn, releaseManagedTask, verifyManagedCandidate } from '../core/managed-tasks.js';
import { sessionCommandSchema, type ManagedSession } from '../core/session-contract.js';
import { readManagedClaim } from '../core/workspace-ownership.js';
import { privateDirectory } from './opencode.js';
import { SessionStore } from './session-store.js';
import { validateManagedStorage } from './managed-opencode.js';

const identitySchema = z.strictObject({ schemaVersion: z.literal(1), ownerId: z.uuid() });
export class ManagedService {
  private constructor(readonly root: string, readonly directory: string, private readonly store: SessionStore,
    private readonly owner: { kind: 'owner'; id: string }) {}

  static async open(rootInput: string, directory: string, runtime: string): Promise<ManagedService> {
    const root = await requireRuntimeWorkspace(rootInput, 'open a managed session in');
    validateManagedStorage(root, directory);
    await privateDirectory(directory);
    const identity = await withProcessLock(path.join(directory, 'identity.lock'), async () => {
      const filename = path.join(directory, 'identity.json');
      const info = await lstat(filename).catch(error => { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; });
      if (info) {
        if (!info.isFile() || info.nlink !== 1 || info.uid !== process.getuid!() || (info.mode & 0o077) || info.size > 512) throw new FoundryError('Managed application identity needs inspection');
        return identitySchema.parse(JSON.parse(await readFile(filename, 'utf8')));
      }
      const value = { schemaVersion: 1 as const, ownerId: randomUUID() };
      await atomicJson(directory, 'identity.json', value);
      return value;
    });
    const store = await SessionStore.open(path.join(directory, 'store'), runtime);
    return new ManagedService(root, directory, store, { kind: 'owner', id: identity.ownerId });
  }

  private async current(): Promise<ManagedSession> {
    const claim = await readManagedClaim(this.root);
    if (!claim || claim.ownerId !== this.owner.id) throw new FoundryError('No session belongs to this managed application');
    return recoverManagedCreation(this.root, this.store, this.owner, claim.create.sessionId);
  }

  async start(input: unknown, requestId: string): Promise<ManagedSession> {
    const profile = managedProfileSchema.parse(input);
    z.uuid().parse(requestId);
    const claim = await readManagedClaim(this.root);
    const session = claim ? await this.current() : await createManagedOpenCodeTask(this.root, this.launches, this.store, this.owner, profile);
    if (session.executor.kind !== 'opencode' || session.executor.profileDigest !== digest(canonicalJson(profile))) throw new FoundryError('Managed profile changed');
    await this.store.accept(sessionCommandSchema.parse({ type: 'message.send', sessionId: session.id, requestId,
      expectedRevision: 0, text: 'Implement only the current approved task.' }), this.owner);
    return this.store.get(session.id, this.owner);
  }

  private get launches(): string { return path.join(this.directory, 'executions'); }
  async status(): Promise<ManagedSession> { return this.current(); }
  async events(after = 0) { const session = await this.current(); return this.store.events(session.id, this.owner, after, 100); }
  async run(profile: unknown, signal?: AbortSignal): Promise<ManagedSession> {
    const session = await this.current();
    return dispatchManagedOpenCodeTurn(this.root, this.launches, this.store, this.owner, { kind: 'supervisor', id: randomUUID() }, session.id, profile, signal);
  }
  async control(action: 'pause' | 'stop' | 'resume' | 'retry', requestId: string, expectedRevision: number): Promise<ManagedSession> {
    const session = await this.current();
    const previous = action === 'resume' || action === 'retry' ? await this.store.stateAt(session.id, this.owner, expectedRevision) : session.state;
    const command = sessionCommandSchema.parse({ type: `session.${action}`, sessionId: session.id, requestId, expectedRevision,
      ...(action === 'resume' && previous.status === 'paused' ? { checkpointId: previous.checkpointId } : {}),
      ...(action === 'retry' && previous.status === 'failed' ? { failedExecutionId: previous.executionId } : {}),
    });
    return controlManagedTask(this.root, this.store, this.owner, command);
  }
  async verify(): Promise<ManagedSession> {
    const session = await this.current();
    return verifyManagedCandidate(this.root, this.store, this.owner, { kind: 'supervisor', id: randomUUID() }, session.id);
  }
  async record(): Promise<ManagedSession> {
    const session = await this.current();
    return publishManagedTask(this.root, this.store, this.owner, { kind: 'inspector', id: randomUUID() }, session.id);
  }
  async release(): Promise<void> { const session = await this.current(); await releaseManagedTask(this.root, this.store, this.owner, session.id); }
  async recover(digest?: string): Promise<unknown> {
    const session = await this.current();
    return recoverManagedOpenCodeTurn(this.root, this.launches, this.store, this.owner, { kind: 'inspector', id: randomUUID() }, session.id, digest);
  }
  async close(): Promise<void> { await this.store.close(); }
}
