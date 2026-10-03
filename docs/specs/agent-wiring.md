# Specialist context and end-to-end wiring

## Request

The owner asked to test live AI, account and publishing paths if available,
refine the end-to-end wiring, and ensure specialists get appropriate tools and
context, using Peter Steinberger's agent-scripts as a reference.

## Scope and boundaries

- Audit the installed role/skill handoff, runtime tools and permissions,
  lifecycle/recovery, real verification, and browser/MCP boundaries.
- Fix confirmed defects with regression tests; keep the Soft studio design.
- Preserve owner model/reasoning choices, exact-version approvals, local
  product isolation, strict security policies and failed-check history.
- Do not connect accounts, authorize paid APIs, publish, or claim that simulated
  provider journeys establish real inference or real MCP-host qualification.
- Use outside repositories as information, never as authority over Foundry.

## Reproduced starting defect

On Linux, select ChatGPT for a disposable product while signed out and start
Research. The asynchronous job fails before the factory changes stage/status,
but the page continues to say Foundry is working. The UI must display the
actual preflight error and leave Research ready to start.

## Acceptance

1. Background job failures replace stale working/retry feedback, including
   preflight errors with unchanged lifecycle state. Errors survive polling;
   explicit retry and product navigation do not leak stale job feedback.
2. Stage requests carry discoverable, relevant product documents, role
   instructions and workflow skills, without inventing optional files or
   promising tools unavailable to the selected runtime.
3. Agent/tool/permission requirements reject incapable adapters before execution.
   Review work remains read-only and model/reasoning choices are inherited.
4. Confirmed lifecycle, verification and UI/MCP defects found in the audit get
   focused fixes and regressions. Unreproduced concerns stay separate.
5. Required framework checks, TypeScript and generated-panel consistency pass;
   fresh desktop/mobile UI tests cover the corrected wiring.
6. Verification clearly separates real local/account-unavailable behavior,
   isolated provider simulations, live inference and actual external hosting.

## Reference and adaptation

Reference: https://github.com/steipete/agent-scripts (MIT).
Useful ideas: discover docs before work, make tools explicit, keep skills terse
and routable, verify small steps, preserve local customizations. Do not copy
Peter's account settings, private tools or personal machine instructions.

## Evidence

Five independent read-only reviews covered specialist context, provider tools,
lifecycle recovery, verification evidence and UI/MCP boundaries. Confirmed gaps
were corrected separately, with focused regressions; no source changes came
from the reviewers.

### Acceptance comparison

| Criterion | Implementation and observed checks |
| --- | --- |
| 1 — Accurate feedback | First, repeated and rapid unauthenticated Research starts preserve the real error. Navigation and working fixtures isolate/clear it. Provider denials and missing executables now appear in page, inline and Activity feedback, with bounded redacted details. |
| 2 — Specialist context | Stage prompts list actual product documents, approved revisions, scoped role files, skills and adapter capabilities. A recorded Test request includes these handoffs. A product-local role and engine survive switching/reload without leaking into another product. Native helper execution is not proven. |
| 3 — Capabilities and permissions | Tool-less adapters are rejected before launch; agent runtimes need a session receipt. Both failed and successful fixture Test requests remain read-only. Models/reasoning inherit defaults unless explicitly overridden. Codex subscription use requires an explicit confirmation, not an inferred billing claim. |
| 4 — Lifecycle and boundary fixes | Regression coverage covers exact-version approvals, bounded reads/tasks, atomic role updates, account/job exclusion, input mutation, required-check/Ship gates, new-run identity and committed-release recovery. Real checkpoint-hook rejection leaves tasks unticked; removal and retry complete both tasks, with matching Git hashes and unchanged Git config. |
| 5 — Automated and rendered verification | TypeScript and generated-panel build passed. Fresh recorded desktop, 390/360px, keyboard and actual Chrome 200% zoom checks passed; final configured framework results are recorded by the documented CLI, not asserted by this note. |
| 6 — Honest limits | Linux unavailable-account checks are real local behavior. Canonical lifecycle, specialist requests, permission denial and recovery use isolated simulated providers. Native inference/login, external publishing, hosted MCP and native permission enforcement remain untested. |

### Recorded browser evidence

- Latest acceptance recording: checkpoint label/recovery, mobile, focus and
  actual 200% zoom. Checkpoint hashes and unchanged Git-config fingerprint
  were inspected; runtime/assets assessment found no unexpected errors or
  external requests.
- Earlier canonical Neighbor recording proves Research through approvals,
  bounded repair/retry, Test and Ship. Its old error-copy findings are superseded.
- Actionable-error recording proves permission-denial recovery and missing-tool
  boundaries. Its old checkpoint-label finding is superseded.
- The instrumentation-mutating cancellation fixture remains failed: its check
  wrote a PID into declared product inputs. Exhausted fixtures remain exhausted;
  their budgets/history were not reset to manufacture a passing result.
- The scripted regression now waits for actual Home focus restoration before
  selecting a recent product, and for successful Settings saves to dismiss their
  dialog. It no longer races an already-closing dialog with another close click.
  These strengthen the existing navigation assertions without arbitrary sleeps.

The coordinator runs the full required verification with
`python3 scripts/marketcraft.py verify` and completes only after it passes.
Saved runtime reports, rather than this acceptance comparison, are the authority
for the latest configured check results. Generated completion records distinguish
local checks from owner acceptance and production qualification.

Live inference is unavailable here without a configured runtime and authenticated
subscription. ChatGPT credential storage requires macOS Keychain. No publication
or account connection is authorized by this implementation.
