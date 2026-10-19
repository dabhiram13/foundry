# Check a coding-client or provider integration

Use this checklist when adding or changing a [provider adapter](PROVIDERS.md)
or [coding-client connection](CONNECTED-CLIENT.md).
Run protocol tests locally, then test the connection with an authorized account.

## Connected coding-client checks

Connection and tool/skill discovery were checked with OpenCode 1.19.0. Node 24/25,
SDK and installed-package fixtures cover the local protocol. The current
rendered-preview workflow has not yet had a live-model product trial.

For a custom OpenAI-compatible endpoint, separately test the model's streamed
tool calls, MCP tool discovery, coding tool use and tool results reaching the
next model turn. Also test authentication failure, rate limits, malformed
responses, unsupported options, context limits, timeout and active-tool stopping.
Record which checks ran; do not infer support from a successful model list.
The [local endpoint check](VALIDATION.md#openai-compatible-host-check) proves the
success path through a fake endpoint, not those live-provider failure cases.

First test preview/apply/remove, preservation of unrelated settings, refusal of
owner-file collisions, stale snapshot rejection, stdio cancellation and a second
client continuing the same saved run. Confirm that no tool can approve scope,
launch a provider or select billing.

With separate account and spending permission, build a small disposable app:

1. Let the host create real checks, a brief and a preparation-enabled contract.
2. Capture sources, submit quoted findings and review their limitations.
3. Save the Plan and verify it pauses for terminal approval.
4. Save Design and verify it needs a new approval before building.
5. Complete dependent tasks, deliberately encounter a failed check and repair it.
6. Stop and continue from another session without inventing a passing result.
7. Submit criterion-level review and inspect the local handoff.
8. Exercise the running app, including mobile and keyboard behavior, and record
   owner acceptance separately from protocol and unit-test results.

Record the host version, Foundry commit, model, OS, budget, commands, findings and
untested gaps. A source-backed report is not independent market validation; a text
Design handoff is not a rendered-interface test. Do not claim other coding clients
or every OpenCode release are qualified by this one connection.

## Local protocol checks

- Validate structured output and reject malformed or oversized results.
- Exercise cancellation, timeouts and recovery.
- Check that credentials are filtered from output and saved records.
- Confirm required capabilities and permission modes are handled correctly.

Use isolated projects and fixture adapters for these checks. See the
[test guide](VALIDATION.md) for repository commands.

## Live connection checks

Agree on the account, permitted billing, usage budget and acceptance criteria
before starting a live run. Then use a disposable project to check:

1. Authentication and model selection.
2. Research source discovery and a report with supporting quotes.
3. Plan and Design approval pauses.
4. A small Build task, its checks and Git checkpoint.
5. Cancellation and recovery from an interrupted task.
6. Test review and the final local Ship summary.

Record the provider and CLI versions, operating system, commands, results and
failures. Keep live results separate from fixture results so contributors can
reproduce each test. Follow the [security guide](../SECURITY.md) when granting
providers access to files or commands.
