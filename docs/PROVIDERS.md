# Provider and runtime adapters

Foundry keeps the owner's interactive Codex session as its normal coordinator.
Nothing here replaces that session, changes authentication, connects an account,
selects a paid plan, or starts another agent automatically. Use this optional seam
when an explicitly authorized task needs a separate local agent process or a
bounded model call. The coordinator owns task selection and integration.

## Two different contracts

| Kind | Responsibility | Not established by a successful result |
| --- | --- | --- |
| `agent-runtime` | Start/resume a session, apply declared permissions/tools, return events, cancel owned local processes | Product correctness, release authority, rollback of external effects |
| `bounded-model` | Return a narrow result from one structured request | Agent tools, browser access, permission management, durable agent sessions |

Codex is the built-in default agent runtime. An explicitly registered local command
can implement either kind. This is a working process protocol, not a universal
provider SDK: another provider needs an adapter executable that implements and
qualifies the contract. Listing a capability is a claim by reviewed adapter code;
it is not proof that a service implements that capability.

`jsonl` and `cancel` are required on every route. Other capabilities are
`structured_output`, `resume`, `permissions`, `tools`, `browser`, `model_selection`
and `reasoning_selection`. An absent required capability is unsupported and rejects
the task before launch. The Codex adapter deliberately does **not** advertise
browser access, since available tools differ between sessions. Bounded model
adapters cannot advertise agent sessions, tools, browser or permission capabilities.

## Commands and integration

The normal entry point is `python3 scripts/marketcraft.py --project PRODUCT provider ...`.
The compatibility entry point `scripts/foundry.py` exposes the same commands.
`scripts/providers.py` also supports them directly for isolated adapter tests.

```text
provider list
provider run docs/work/agent-request.json
provider status [TASK_ID]
provider resume TASK_ID docs/work/agent-request.json
provider cancel TASK_ID
provider reconcile TASK_ID [--acknowledge-stopped]
```

`run` and `resume` execute the selected command and can consume authorized provider
usage. All other commands are local inspection/control. `run` creates a task UUID;
`resume` keeps that UUID, previous attempts, usage, elapsed budget and session ID.
It never chooses a different adapter or model. Change the prompt when continuing,
but preserve the adapter, model/reasoning preferences, permissions, schema,
capabilities, billing contract and budget. A task without a returned session ID
starts a fresh process attempt; there is no invented conversation memory.

The module exports `ACTIONS = {"provider"}`, `add_commands(subparsers)` and
`run(root, args) -> int`. It does not import the core lifecycle or complete a product
run. Exit code 0 means a protocol-complete result, 1 a failed/unknown/budget result,
130 cancellation and 2 an invalid or blocked request.

## A Codex request

The coordinator prepares a project-relative JSON request within existing owner
authorization. Do not put credentials in it. This example requires the owner to
have confirmed that the selected local Codex login uses their subscription.

```json
{
  "adapter": "codex",
  "kind": "agent-runtime",
  "prompt": "Inspect the accepted spec and return the next unresolved criterion.",
  "required_capabilities": ["structured_output", "permissions"],
  "permissions": {"sandbox": "read-only"},
  "billing": {"mode": "subscription", "confirmed": true},
  "budget": {
    "max_attempts": 2,
    "max_concurrency": 1,
    "max_elapsed_seconds": 300,
    "max_api_dollars": 0
  },
  "output_schema": {
    "type": "object",
    "properties": {"next_criterion": {"type": "string"}},
    "required": ["next_criterion"],
    "additionalProperties": false
  }
}
```

Omit `model` and `reasoning` to inherit the owner's Codex choices. Supplying either
is an explicit request for that setting, not automatic escalation. Requested and
resolved models are separate receipt fields; absent runtime reporting leaves the
resolved model null. Codex defaults to the narrower read-only sandbox; a task may
explicitly request `workspace-write`. Bypass flags, extra writable directories and
arbitrary Codex configuration overrides are not exposed by this adapter.

Command construction follows the inspected local `codex-cli 0.142.3` help:
`codex exec --json --sandbox ... [--output-schema FILE] -`; continuation uses
`codex exec resume --json -c 'sandbox_mode="..."' SESSION_ID -`. Resume's CLI has
no `--sandbox` flag. Prompts go through stdin, not process arguments. The runner
recognizes `thread.started`, `item.completed` agent messages, `turn.completed`
usage and error events. A changed CLI/event format must be qualified again.

Supported output schema keywords are `type`, `properties`, `required`,
`additionalProperties` (boolean), `items`, `enum`, `description` and `title`.
Types are object, array, string, integer, number, boolean and null. Unsupported
schema features are rejected before launch, rather than silently ignored.

## Registering a local command

Put reviewed adapter metadata in `.foundry/providers.json`. `codex` is reserved;
the command list executes directly with no shell expansion, from the product root.

```json
{
  "adapters": [{
    "name": "local-classifier",
    "kind": "bounded-model",
    "command": ["/absolute/path/to/python3", "/absolute/path/to/adapter.py"],
    "capabilities": ["jsonl", "cancel", "structured_output"],
    "billing_modes": ["local"]
  }]
}
```

The command receives one JSON object on stdin containing the request, protocol
`marketcraft-jsonl-v1`, task UUID, attempt number, `operation` (`start`/`resume`) and
session ID. It emits JSON objects, one per stdout line. Diagnostics use stderr.
For an agent runtime, emit a valid session ID before working. Model reporting is
optional; it must describe the resolved model, not repeat a requested alias.

```jsonl
{"type":"session.started","session_id":"session-123","model":"resolved-model"}
{"type":"result","status":"completed","output":{"next_criterion":"AC-2"},"usage":{"input_tokens":12,"output_tokens":8,"reliable":true}}
```

A bounded model emits only the result; it has no agent session. Every successful
attempt requires exactly one completed result and a final output. With an output
schema, that output must satisfy the supported schema. A zero process exit without
the receipt is unknown. An error may include `code` and `message`; rate limits
produce a failed attempt and never trigger fallback. Usage is accepted only with
`reliable: true` from this protocol; report only actual known quantities. Omitted
quantities remain null. An API adapter may additionally report `api_dollars`.

The command is trusted installed code. Capability metadata does not sandbox it:
it inherits the invoking process's OS permissions and environment. An agent
adapter claiming `permissions` must actually apply its requested permission policy.
Do not register a shell wrapper that merely claims to enforce sandboxing. Native
Codex approval/sandbox rules remain authoritative. Remote tasks that detach from
the owned process group need an independently implemented remote cancellation
contract before they can claim `cancel`.

## Budgets and billing facts

Budgets persist across attempts and resume. Attempt and elapsed limits apply per
task. Concurrency limits apply to this project's provider tasks; an active task's
lower limit cannot be bypassed by starting one with a higher limit. Unknown tasks
occupy a slot until reconciled. Interactive sessions outside this module are not
counted. These are local operating bounds, not account-wide billing controls.

Billing mode must be explicitly selected from the adapter's advertised modes:
`subscription`, `api` or `local`. The runner never inspects credentials and cannot
independently certify which Codex credential is active. Subscription mode requires
the owner's existing confirmation, recorded as an attestation, not an observed
billing fact. Do not infer included task allowance from token usage or API prices.
`subscription_allowance_remaining` stays null unless a future authoritative
integration supplies it. Generated SaaS customer authentication is unrelated.

For API execution, all of the following are required in `billing`:

```json
{
  "mode": "api",
  "allow_api": true,
  "acknowledge_posthoc_cost": true,
  "reservation_dollars": 0.50
}
```

`max_api_dollars` must be positive and cover the reservation. Before each attempt,
the known spend plus reservation must fit that task's remaining budget. A prior
unknown API cost blocks another paid attempt. Reservations are estimates, not
provider-enforced caps: in-flight spend can exceed them. A reported overrun is
recorded as `budget_exceeded`, never hidden. Charges reported on a subscription or
local route produce `billing_violation` and block another attempt on that task.
No provider changes, retries, model escalation or paid fallback happen automatically.

Receipts distinguish total API dollars (null if incomplete), known-dollar subtotal,
token usage and unknown subscription allowance. Provider-reported costs are not
independently audited invoices. The wrapper cannot provide a hard money limit when
the service reports usage only after completion.

## Interruption, evidence and trust

State is owned by this module under `.foundry/state/providers/`; do not hand-edit
task records. A short registry lock serializes budget decisions, and a per-task
lease prevents simultaneous runners. Each attempt saves its start before launch,
then session/usage receipts as they arrive and the final outcome. State uses atomic
writes. SIGINT, SIGTERM, explicit cancel and elapsed expiry terminate the process
group created by the live invocation, including descendants in that group.
`cancel` first records a request; confirm the subsequent `canceled` result.

SIGKILL or host failure cannot be handled synchronously. After the owning process
disappears, `reconcile` records an unknown outcome without sending signals to a
possibly reused persisted PID. Inspect/stop any old process and check committed
effects before using `--acknowledge-stopped`. That acknowledgment permits explicit
continuation but does not erase attempts, spend or elapsed time. For an incomplete
attempt, each reconciliation conservatively charges wall time since start up to
the remaining elapsed budget until the process is acknowledged stopped. An early
unknown result does not freeze the clock or subtract its estimate twice; prior
completed attempts remain charged. Unknown API charges still block paid continuation. Missing a
completion event never proves an external effect was rolled back.

Evidence contains bounded, sanitized JSONL event receipts, command/prompt hashes,
session identity, models, settings, timing and outcomes. Prompts and credentials
are not intentionally persisted. Files are created with private permissions.
Known credential-shaped values, sensitive fields and secret-valued inherited
environment variables are redacted. This is best-effort redaction, not proof that
arbitrary provider prose contains no confidential content: keep secrets out of
prompts/results, keep receipts private and review before sharing. Raw event
structure is preserved after redaction, not as a byte-exact provider transcript.
Output is bounded at 2 MiB per attempt and 256 KiB per event/request.

The ledger shares the product user's trust boundary; it is not tamper-proof
attestation. `completed` establishes process/protocol completion only. The parent
still integrates the result, compares acceptance criteria and runs product checks.

## Verification

`python3 -m unittest discover -s tests -p test_providers.py -v` exercises real local
processes and a fake Codex executable: session continuation, structured results,
missing capabilities, model inheritance, billing rejection, unknown usage,
reservations/overspend, no rate-limit fallback, SIGTERM/cancel/timeout descendants,
concurrency, dead-runner reconciliation, schema checks, redaction and safe paths.
Tests make no provider calls and consume no subscription or API inference.

Live Codex inference, other providers, their actual permission implementation,
service billing, remote cancellation and complete SaaS delivery remain unverified
until separately authorized qualification runs demonstrate them.
