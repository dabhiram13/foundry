# Orchestration State — Optional, Default Off

> Proposed Supabase model for detached orchestrators. Not live. Not in `db-schema.md` yet.

## Product Stance

This is **not** the main product path.

The main path remains:

`main session -> /start -> discover/spec/plan/build -> sub-agents`

Detached orchestrators are an **optional acceleration mode** for parallel, unrelated features. They should be available to the orchestrator as a capability, but disabled by default.

## Activation Rules

| Rule | Value |
|------|-------|
| Default | `detached_orchestrators_enabled = false` |
| Max workers | 2-3 |
| Use only when | features are independent and file scopes do not overlap |
| Parent behavior | partition work, write handoff packets, spawn workers, then stop |
| Prompt surface | may mention the capability even when off; must not auto-use while off |

## What This Mode Is

- one orchestrator partitions work into 2-3 independent subsets
- each subset gets:
  - its own git worktree
  - its own tmux-backed Claude session
  - its own handoff packet
- the parent session exits after spawn
- each child becomes the active orchestrator for its feature until done, blocked, or failed

## What This Mode Is Not

- not the default build flow
- not agent teams as the primary runtime
- not child-to-child messaging
- not a watchdog or mail bus
- not recursive spawning
- not a full merge queue

## Proposed Tables

### `orchestration_settings`

Per-user or per-workspace toggle.

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | uuid PK FK -> auth.users.id | owner |
| `detached_orchestrators_enabled` | boolean not null default false | hard gate |
| `max_parallel_orchestrators` | integer not null default 2 | clamp to 1-3 |
| `updated_at` | timestamptz not null default now() | audit |

**RLS**
- owner can read own row
- owner can update own row
- service role can read/write

### `orchestration_runs`

One record per detached run.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK default gen_random_uuid() | run id |
| `user_id` | uuid not null FK -> auth.users.id | owner |
| `mode` | text not null | `subagents` or `detached` |
| `goal` | text not null | high-level objective |
| `status` | text not null default `booting` | `booting`, `running`, `complete`, `failed`, `cancelled` |
| `parent_session_id` | text | session that spawned children |
| `metadata` | jsonb not null default '{}' | free-form context |
| `created_at` | timestamptz not null default now() | audit |
| `updated_at` | timestamptz not null default now() | audit |

**RLS**
- owner can read own runs
- owner cannot mutate worker-owned operational fields directly
- service role can read/write

### `orchestration_workers`

One row per detached child orchestrator.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK default gen_random_uuid() | worker id |
| `run_id` | uuid not null FK -> orchestration_runs.id | parent run |
| `worker_key` | text not null | stable name like `billing` or `editor` |
| `role` | text not null default `orchestrator` | future-safe, keep simple |
| `branch_name` | text not null | worktree branch |
| `worktree_path` | text not null | local path |
| `scope_globs` | text[] not null default '{}' | ownership boundary |
| `handoff_path` | text not null | markdown packet on disk |
| `status` | text not null default `booting` | `booting`, `working`, `blocked`, `done`, `failed`, `cancelled` |
| `heartbeat_at` | timestamptz | liveness |
| `last_summary` | text | concise progress line |
| `created_at` | timestamptz not null default now() | audit |
| `updated_at` | timestamptz not null default now() | audit |

**Indexes**
- `(run_id, status)`
- `(run_id, worker_key)`
- `(heartbeat_at)`

## Local Artifacts

Supabase stores state, not full reasoning.

Each worker should still get a local handoff packet, for example:

`dev/active/{feature}/orchestrator-handoff.md`

The database stores the pointer, not the entire prompt transcript.

## Prompt Contract

The orchestration prompt may advertise the capability like this:

> Optional capability: detached orchestrators are available when enabled. Use only for 2-3 independent features with non-overlapping scope. If used, write handoff packets, spawn isolated worktree sessions, and stop the parent session.

That line should remain visible even when the feature is off. It explains what the system can do. It does **not** authorize auto-use.

## Merge Helper — Borrow This, Keep It Small

This mode should include a bounded merge helper for detached branches:

1. **Tier 1 — Clean merge**
   - `git merge --no-ff`
2. **Tier 2 — Deterministic auto-resolve**
   - regex keep-incoming / union logic
   - include a contentful-canonical guard so we do not silently drop meaningful canonical content
3. **Tier 3 — Per-file LLM resolve**
   - `--print` one conflicted file at a time
   - reject prose output with a hard regex such as:
     - `^I `
     - `^Here's`
     - `` ``` ``
     - `I cannot`

Tier 4 reimagine is out of scope for the first version.

## Non-Goals

- no event bus
- no inter-worker mail
- no nudge system
- no merge queue
- no swarm-style control plane

If those become necessary, that is a separate product/runtime concern, not a first extension of `superclaude`.
