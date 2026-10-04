# Contributing to Foundry

Foundry is a framework, not a particular person's project configuration. Changes
should work for a fresh checkout with no private accounts or paid AI execution.

## Start locally

Read [the setup guide](docs/GETTING-STARTED.md), [architecture](docs/ARCHITECTURE.md)
and [working agreements](AGENTS.md). The stable launcher currently uses Python
3.11+. Use Node.js 24 LTS for the frontend, documentation site and staged TypeScript
runtime. Git is required for product checkpoints.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm ci
./foundry --help
```

Create test products outside this checkout. Do not use a real project to exercise
migration, failure or cancellation. Fake-provider tests do not need an AI account
and do not establish live provider support. Do not commit tokens, product data,
local state or private source archives.

## Make a focused change

1. Describe the expected behavior and relevant failure cases in the issue or PR.
2. For substantial changes, add a specification with observable criteria under
   `docs/specs/`. Reuse existing design decisions rather than redesigning the UI.
3. Change the shared implementation, not just one CLI or browser symptom.
4. Add a regression through the public interface. Preserve required checks,
   approval boundaries, billing consent and unknown/failed outcomes.
5. Update the relevant source documentation when commands or behavior change.

The docs website is generated from repository Markdown. Edit the original page,
not the generated content under `site/src/content/docs/`.

## Checks

Use the current [framework check commands](README.md#check-the-framework).
Start with tests covering your change, then run the required final checks.
Frontend changes require typechecking, the panel build and desktop/mobile browser
checks. Keep generated panel assets synchronized. A skipped integration must be
reported as untested, not passed. Do not weaken a check to make a migration green.

## Pull requests

Explain the behavior change, tests run, compatibility effects and any limitations.
Keep unrelated formatting and generated reports out of the patch. If you reuse
upstream material, record its source and retain the appropriate license notices.
The project contains mixed-provenance reference material; an open-source framework
does not make every separately advertised upstream product part of this repository.

For a security issue, follow [the security guidance](SECURITY.md) before posting
reproduction details publicly.
