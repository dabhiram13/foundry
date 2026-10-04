# Terminal-first entry and aligned documentation

## Authority and scope
The owner finalized the dark design and approved a simpler install-first landing,
terminal-led product workflow, optional local browser, aligned documentation and
merge after checks. A later architecture research discussion is separate work.
Resume the existing source-backed-controls run; this is its accepted scope amendment.
Do not modify state by hand or start a competing run.

## Criteria
- CLI-1: `./foundry` / `--help` explain terminal commands without opening a browser
  or using AI. `./foundry ui` explicitly opens the existing browser interface.
  Retain old browser flags for compatibility. Bootstrap checks Python >=3.11.
- CLI-2: new, list, status, configure, run, review, approve, stop and providers
  use the existing Factory/provider state and guards, not another workflow.
  Resolve project UUID or exact slug within the chosen products directory.
  One run invocation executes one stage; failed/interrupted work is nonzero.
- CLI-3: review reads the pending Plan/Design through artifact_record and prints
  its exact revision; approve requires --revision. Stale approvals fail closed.
  No automatic subscription confirmation, billing authorization or publishing.
  Stop requests cancellation; it never claims a running process has stopped.
- CLI-4: Codex is built in; registered local agent adapters retain their existing
  contract. Experimental ChatGPT login remains browser-only. API-billed factory
  runs and universal model-URL support are not added or claimed.
- DOC-1: README, start guide, docs index and relevant setup/architecture/runtime
  references agree with terminal help, supported platforms, provider boundaries,
  optional browser entry, local files versus cloud inference, and update/recovery.
  Provider setup includes an executable no-AI smoke example of the existing
  bounded-model protocol, explicitly not a product-building agent.
- UI-9: landing header/hero lead to installation/docs, not project management.
  Walkthrough shows tested terminal commands, never fabricated test results.
  Browser access is secondary; workspace controls remain available there.

## UX amendment
Audience: people installing a local developer tool. Preserve approved dark tokens,
controls, brand and responsive structure. Entry: install -> Codex login -> create
-> explicit confirmation -> run/review/approve -> build/check. The landing's three
tabs explain that sequence, with an optional browser link below installation.
Missing login, failed checks and unavailable adapters remain visible failures.
Rendered QA must check desktop, 390px and 360px plus install focus/tab navigation.

## Verification
Use no live AI, account connection or paid services. New command tests should
exercise subprocess CLI boundaries with local fixtures: stage progression,
revision approvals/stale rejection, failed run exit, provider selection and
shared terminal/browser state. Verify documentation examples and link targets.
Run TypeScript, panel build, studio browser check and configured verification.
Refresh verification after final commit before completing the active run.
