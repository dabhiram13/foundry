import { DatabaseSync } from 'node:sqlite';
import { closeSync, existsSync, lstatSync, mkdirSync, openSync } from 'node:fs';
import path from 'node:path';
import { digest, digestJson, rejectSymlinkComponents } from '../core/fs.js';
import {
  SessionError, effectSchema, receiptSchema, sessionEventSchema, sessionSchema,
  type ManagedSession, type SessionActor, type SessionCommand, type SessionEffect,
  type SessionEvent, type SessionReceipt,
} from '../core/session-contract.js';
import { assertSessionAccess, transitionSession } from '../core/sessions.js';

const migration = `
CREATE TABLE migrations (version INTEGER PRIMARY KEY, checksum TEXT NOT NULL) STRICT;
CREATE TABLE sessions (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, project_id TEXT NOT NULL,
  status TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision >= 0),
  snapshot TEXT NOT NULL CHECK(json_valid(snapshot))
) STRICT;
CREATE UNIQUE INDEX active_project ON sessions(project_id) WHERE status != 'stopped';
CREATE TABLE commands (
  actor TEXT NOT NULL, request_id TEXT NOT NULL, session_id TEXT NOT NULL REFERENCES sessions(id),
  digest TEXT NOT NULL, receipt TEXT NOT NULL CHECK(json_valid(receipt)),
  PRIMARY KEY(actor, request_id)
) STRICT;
CREATE TABLE events (
  session_id TEXT NOT NULL REFERENCES sessions(id), sequence INTEGER NOT NULL CHECK(sequence > 0),
  payload TEXT NOT NULL CHECK(json_valid(payload)), PRIMARY KEY(session_id, sequence)
) STRICT;
CREATE TABLE effects (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id),
  execution_id TEXT NOT NULL, status TEXT NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload))
) STRICT;
`;

export function storageError(error: unknown): SessionError {
  if (error instanceof SessionError) return error;
  const code = error && typeof error === 'object' && 'errcode' in error ? Number(error.errcode) & 255 : 0;
  return new SessionError(code === 5 || code === 6 ? 'storage_busy' : 'storage_invalid');
}

function privateFile(directory: string): string {
  if (!path.isAbsolute(directory) || !process.getuid || process.platform === 'win32') throw new SessionError('storage_invalid');
  rejectSymlinkComponents(directory);
  for (let ancestor = directory; ; ancestor = path.dirname(ancestor)) {
    if (existsSync(path.join(ancestor, '.git'))) throw new SessionError('storage_invalid');
    if (ancestor === path.dirname(ancestor)) break;
  }
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  rejectSymlinkComponents(directory);
  const dir = lstatSync(directory);
  if (!dir.isDirectory() || dir.uid !== process.getuid() || (dir.mode & 0o077)) throw new SessionError('storage_invalid');
  const filename = path.join(directory, 'sessions.sqlite');
  try {
    closeSync(openSync(filename, 'wx', 0o600));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  for (const file of [filename, `${filename}-journal`, `${filename}-wal`, `${filename}-shm`]) {
    try {
      const info = lstatSync(file);
      if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.uid !== process.getuid() || (info.mode & 0o077)) {
        throw new SessionError('storage_invalid');
      }
      if (file.endsWith('-wal') || file.endsWith('-shm')) throw new SessionError('storage_invalid');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return filename;
}

function json(value: unknown, maxLength: number): unknown {
  if (typeof value !== 'string' || value.length > maxLength) throw new SessionError('storage_invalid');
  return JSON.parse(value) as unknown;
}

export class SessionDatabase {
  private readonly db: DatabaseSync;

  constructor(directory: string) {
    this.db = new DatabaseSync(privateFile(directory), { timeout: 100, allowExtension: false, enableForeignKeyConstraints: true });
    try {
      if (this.db.prepare('PRAGMA journal_mode').get()?.journal_mode !== 'delete') throw new SessionError('storage_invalid');
      this.db.exec('PRAGMA synchronous=EXTRA; PRAGMA trusted_schema=OFF;');
      this.transaction(() => {
        const version = this.db.prepare('PRAGMA user_version').get()?.user_version;
        if (version !== 0 && version !== 1) throw new SessionError('storage_invalid');
        if (version === 0) {
          if (this.db.prepare("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").get()) throw new SessionError('storage_invalid');
          this.db.exec(migration);
          this.db.prepare('INSERT INTO migrations VALUES (1, ?)').run(digest(migration));
          this.db.exec('PRAGMA user_version=1');
        }
        const checksum = this.db.prepare('SELECT checksum FROM migrations WHERE version=1').get()?.checksum;
        if (checksum !== digest(migration) || this.db.prepare('SELECT version FROM migrations WHERE version != 1').get()) {
          throw new SessionError('storage_invalid');
        }
      });
      const integrity = this.db.prepare('PRAGMA quick_check').get();
      if (integrity?.quick_check !== 'ok' || this.db.prepare('PRAGMA foreign_key_check').get()) throw new SessionError('storage_invalid');
    } catch (error) {
      this.db.close();
      throw storageError(error);
    }
  }

  private transaction<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      try { this.db.exec('ROLLBACK'); } catch { /* The receipt decides an uncertain commit on retry. */ }
      throw storageError(error);
    }
  }

  private read(id: string): ManagedSession | null {
    const row = this.db.prepare('SELECT id, owner_id, project_id, status, revision, CASE WHEN length(snapshot) <= 16384 THEN snapshot END AS snapshot FROM sessions WHERE id=?').get(id);
    if (!row) return null;
    const session = sessionSchema.parse(json(row.snapshot, 16_384));
    if (session.id !== row.id || session.ownerId !== row.owner_id || session.assignment.projectBindingId !== row.project_id
      || session.state.status !== row.status || session.revision !== row.revision) throw new SessionError('storage_invalid');
    return session;
  }

  get(id: string, actor: SessionActor): ManagedSession {
    const session = this.read(id);
    if (!session) throw new SessionError('not_found');
    assertSessionAccess(session, actor);
    return session;
  }

  accept(command: SessionCommand, actor: SessionActor): SessionReceipt {
    return this.transaction(() => {
      const current = this.read(command.sessionId);
      if (current) assertSessionAccess(current, actor);
      const actorKey = `${actor.kind}:${actor.id}`;
      const commandDigest = digestJson(command);
      const prior = this.db.prepare('SELECT digest, CASE WHEN length(receipt) <= 4096 THEN receipt END AS receipt FROM commands WHERE actor=? AND request_id=?').get(actorKey, command.requestId);
      if (prior) {
        if (prior.digest !== commandDigest) throw new SessionError('idempotency_conflict');
        return receiptSchema.parse(json(prior.receipt, 4096));
      }
      const clock = Date.now();
      const at = new Date(clock).toISOString();
      let session: ManagedSession;
      let data: Array<SessionEvent['data']>;
      let effects: SessionEffect[] = [];
      if (command.type === 'session.create') {
        if (actor.kind !== 'owner') throw new SessionError('forbidden');
        if (current) throw new SessionError('idempotency_conflict');
        if (this.db.prepare("SELECT id FROM sessions WHERE project_id=? AND status != 'stopped'").get(command.assignment.projectBindingId)) {
          throw new SessionError('project_busy');
        }
        session = sessionSchema.parse({
          schemaVersion: 1, id: command.sessionId, ownerId: actor.id,
          assignment: command.assignment, executor: command.executor, consentRef: command.consentRef,
          maxTurns: command.maxTurns, turnsUsed: 0, outputBytes: 0, revision: 0, sequence: 1, fence: 0,
          createdAt: at, updatedAt: at, state: { status: 'idle' },
        });
        this.db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?)').run(
          session.id, session.ownerId, session.assignment.projectBindingId, session.state.status, session.revision, JSON.stringify(session),
        );
        data = [{ kind: 'state', state: session.state }];
      } else {
        if (!current) throw new SessionError('not_found');
        const transition = transitionSession(current, command, actor, clock);
        session = sessionSchema.parse(transition.session);
        data = transition.events;
        effects = transition.effects.map((effect) => effectSchema.parse(effect));
        const changed = this.db.prepare('UPDATE sessions SET status=?, revision=?, snapshot=? WHERE id=? AND revision=?').run(
          session.state.status, session.revision, JSON.stringify(session), session.id, current.revision,
        );
        if (Number(changed.changes) !== 1) throw new SessionError('revision_conflict');
        if (transition.priorEffects !== 'keep') {
          const status = { claim: 'claimed', confirm: 'confirmed', cancel: 'canceled', 'cancel-pause': 'canceled', uncertain: 'uncertain' }[transition.priorEffects];
          const old = this.readEffects(session.id).filter((effect) => effect.status === 'pending' || effect.status === 'claimed' || effect.status === 'uncertain');
          for (const effect of old) {
            if (transition.priorEffects === 'claim' && effect.status !== 'pending') continue;
            if (transition.priorEffects === 'cancel-pause' && (effect.kind !== 'pause' || effect.status !== 'pending'
              || !('executionId' in session.state) || effect.executionId !== session.state.executionId)) continue;
            const updated = effectSchema.parse({ ...effect, status });
            this.db.prepare('UPDATE effects SET status=?, payload=? WHERE id=?').run(status, JSON.stringify(updated), effect.id);
          }
        }
      }
      for (let index = 0; index < data.length; index++) {
        const event = sessionEventSchema.parse({
          schemaVersion: 1, sessionId: session.id, sequence: session.sequence - data.length + index + 1,
          revision: session.revision, at, source: actor.kind, data: data[index],
        });
        this.db.prepare('INSERT INTO events VALUES (?, ?, ?)').run(session.id, event.sequence, JSON.stringify(event));
      }
      for (const effect of effects) {
        this.db.prepare('INSERT INTO effects VALUES (?, ?, ?, ?, ?)').run(effect.id, session.id, effect.executionId, effect.status, JSON.stringify(effect));
      }
      const receipt = receiptSchema.parse({
        sessionId: session.id, requestId: command.requestId, acceptedRevision: session.revision,
        eventSequence: session.sequence, effectIds: effects.map((effect) => effect.id),
      });
      this.db.prepare('INSERT INTO commands VALUES (?, ?, ?, ?, ?)').run(actorKey, command.requestId, session.id, commandDigest, JSON.stringify(receipt));
      return receipt;
    });
  }

  events(id: string, actor: SessionActor, after: number, limit: number): { events: SessionEvent[]; nextCursor: number; hasMore: boolean } {
    return this.transaction(() => {
      const session = this.get(id, actor);
      if (after > session.sequence) throw new SessionError('cursor_invalid');
      const rows = this.db.prepare('SELECT sequence, CASE WHEN length(payload) <= 100000 THEN payload END AS payload FROM events WHERE session_id=? AND sequence>? ORDER BY sequence LIMIT ?').all(id, after, limit + 1);
      const events = rows.slice(0, limit).map((row, index) => {
        const event = sessionEventSchema.parse(json(row.payload, 100_000));
        if (event.sessionId !== id || event.sequence !== after + index + 1 || row.sequence !== event.sequence) throw new SessionError('storage_invalid');
        return event;
      });
      const nextCursor = events.at(-1)?.sequence ?? after;
      if (nextCursor < session.sequence && rows.length <= limit) throw new SessionError('storage_invalid');
      return { events, nextCursor, hasMore: rows.length > limit };
    });
  }

  effects(id: string, actor: SessionActor): SessionEffect[] {
    return this.transaction(() => {
      this.get(id, actor);
      return this.readEffects(id);
    });
  }

  private readEffects(id: string): SessionEffect[] {
    const rows = this.db.prepare('SELECT id, execution_id, status, CASE WHEN length(payload) <= 100000 THEN payload END AS payload FROM effects WHERE session_id=? ORDER BY rowid LIMIT 301').all(id);
    if (rows.length > 300) throw new SessionError('storage_invalid');
    return rows.map((row) => {
      const effect = effectSchema.parse(json(row.payload, 100_000));
      if (effect.id !== row.id || effect.sessionId !== id || effect.executionId !== row.execution_id || effect.status !== row.status) throw new SessionError('storage_invalid');
      return effect;
    });
  }

  close(): void {
    this.db.close();
  }
}
