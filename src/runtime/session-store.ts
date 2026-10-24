import { randomUUID } from 'node:crypto';
import { lstat } from 'node:fs/promises';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { z } from 'zod';
import {
  SessionError, effectSchema, eventPageSchema, receiptSchema, sessionSchema, sessionStateSchema,
  type SessionActor, type SessionCommand, type SessionEffect, type SessionReceipt, type ManagedSession,
} from '../core/session-contract.js';
import { sessionReplySchema, sessionRequestSchema, storageReadySchema, storageWorkerDataSchema, type SessionRequest } from './session-rpc.js';

type Pending = { resolve: (data: unknown) => void; reject: (error: SessionError) => void; timer: NodeJS.Timeout };

export class SessionStore {
  private readonly pending = new Map<string, Pending>();
  private dead = false;
  private closing = false;
  private readonly exited: Promise<void>;
  private readyResolve!: () => void;
  private readyReject!: (error: SessionError) => void;
  private readonly ready = new Promise<void>((resolve, reject) => { this.readyResolve = resolve; this.readyReject = reject; });
  private readonly startup: NodeJS.Timeout;

  private constructor(private readonly worker: Worker) {
    this.exited = new Promise((resolve) => worker.once('exit', () => { this.fail(); resolve(); }));
    this.startup = setTimeout(() => this.fail(), 10_000);
    worker.on('error', () => this.fail());
    worker.on('message', (input: unknown) => {
      const ready = storageReadySchema.safeParse(input);
      if (ready.success) {
        clearTimeout(this.startup);
        if (ready.data.ready) this.readyResolve();
        else this.fail(new SessionError(ready.data.code));
        return;
      }
      const reply = sessionReplySchema.safeParse(input);
      if (!reply.success) { this.fail(); return; }
      const pending = this.pending.get(reply.data.id);
      if (!pending) { this.fail(); return; }
      clearTimeout(pending.timer);
      this.pending.delete(reply.data.id);
      if (reply.data.ok) pending.resolve(reply.data.data);
      else pending.reject(new SessionError(reply.data.code));
    });
  }

  static async open(directory: string, runtimeDirectory: string): Promise<SessionStore> {
    if (!storageWorkerDataSchema.safeParse({ directory }).success) throw new SessionError('invalid_input');
    const filename = path.join(runtimeDirectory, 'foundry-session-storage.cjs');
    const info = await lstat(filename).catch(() => null);
    if (!path.isAbsolute(filename) || !info?.isFile() || info.isSymbolicLink()) throw new SessionError('worker_unavailable');
    let worker: Worker;
    try { worker = new Worker(filename, { workerData: { directory } }); }
    catch { throw new SessionError('worker_unavailable'); }
    const store = new SessionStore(worker);
    try { await store.ready; return store; }
    catch (error) { await store.worker.terminate(); throw error; }
  }

  private fail(error = new SessionError('worker_unavailable')): void {
    if (this.dead) return;
    this.dead = true;
    clearTimeout(this.startup);
    this.readyReject(error);
    for (const entry of this.pending.values()) { clearTimeout(entry.timer); entry.reject(error); }
    this.pending.clear();
    void this.worker.terminate();
  }

  private async request<T>(input: SessionRequest, schema: z.ZodType<T>): Promise<T> {
    if (this.dead || (this.closing && input.type !== 'close')) throw new SessionError('worker_unavailable');
    const parsed = sessionRequestSchema.safeParse(input);
    if (!parsed.success) throw new SessionError('invalid_input');
    if (this.pending.size >= 64) throw new SessionError('storage_busy');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(), 10_000);
      this.pending.set(input.id, {
        reject, timer,
        resolve: (data) => {
          const result = schema.safeParse(data);
          if (result.success) resolve(result.data);
          else {
            const error = new SessionError('storage_invalid');
            reject(error);
            this.fail(error);
          }
        },
      });
      try { this.worker.postMessage(parsed.data); }
      catch { this.fail(); }
    });
  }

  async accept(command: SessionCommand, actor: SessionActor): Promise<SessionReceipt> {
    return this.request({ id: randomUUID(), type: 'accept', command, actor }, receiptSchema);
  }

  async get(sessionId: ManagedSession['id'], actor: SessionActor): Promise<ManagedSession> {
    return this.request({ id: randomUUID(), type: 'get', sessionId, actor }, sessionSchema);
  }

  async stateAt(sessionId: ManagedSession['id'], actor: SessionActor, revision: number) {
    return this.request({ id: randomUUID(), type: 'state-at', sessionId, actor, revision }, sessionStateSchema);
  }

  async events(sessionId: ManagedSession['id'], actor: SessionActor, after = 0, limit = 100): Promise<z.infer<typeof eventPageSchema>> {
    return this.request({ id: randomUUID(), type: 'events', sessionId, actor, after, limit }, eventPageSchema);
  }

  async effects(sessionId: ManagedSession['id'], actor: SessionActor): Promise<SessionEffect[]> {
    return this.request({ id: randomUUID(), type: 'effects', sessionId, actor }, z.array(effectSchema).max(300));
  }

  async close(): Promise<void> {
    if (this.dead || this.closing) { await this.exited; return; }
    this.closing = true;
    try {
      await this.request({ id: randomUUID(), type: 'close' }, z.null());
      let timer: NodeJS.Timeout | undefined;
      try {
        const confirmed = await Promise.race([
          this.exited.then(() => true),
          new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), 2000); }),
        ]);
        if (!confirmed) throw new SessionError('worker_unavailable');
      } finally { clearTimeout(timer); }
    } finally {
      this.fail();
    }
  }
}
