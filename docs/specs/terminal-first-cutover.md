# One terminal-first Foundry

Status: implemented. This spec records the terminal-only boundaries and acceptance
criteria; current setup and qualification limits are in the main documentation.
It does not authorize npm publication.

## Outcome

Ship one TypeScript framework on Node 24, installed and built with npm, with one
public `foundry` executable. With an interactive terminal, `foundry` opens the
terminal interface. Explicit subcommands and JSON output call the same service
for scripts and automation. Without a terminal, a bare invocation prints guidance
and exits rather than waiting for input. There is no browser workspace.

The existing Vercel connection serves only the static landing page and docs.
Do not provision another deployment, change account settings or trigger a manual
release. Repository pushes may trigger the owner's existing Vercel integration.

This supersedes the earlier product direction of parallel Python/typed paths and
CLI/browser/MCP interfaces. Superseded implementation records remain in Git
history; do not keep a second execution path or duplicate historical manuals.

## Final boundaries

Reference decisions (official documentation inspected for this implementation):

- OpenCode's primary/specialist agents and permission separation inform explicit
  stage roles: https://opencode.ai/docs/agents/ . Do not copy its separate server.
- Pi's small core and packaged extensions/skills inform modular, provider-neutral
  role policies: https://github.com/earendil-works/pi . Do not add a marketplace or
  automatically execute downloaded extensions. Local policies are not a sandbox.
- Prime Agent's saved sessions and recovery inform continuity:
  https://github.com/PrimeIntellect-ai/prime-agent . Do not adopt its persistent
  Python REPL, scheduling or recursively communicating background agents.

The controller assigns roles and checks handoffs; provider runtimes perform the
work. Model outputs never grant approvals or change the spending/check policy.
Specialist roles are reusable policies, not a claim that every role starts an
independent process or that all referenced harnesses are qualified adapters.

```text
foundry: terminal interface or explicit commands
                  |
          one TypeScript service
                  |
        lifecycle and saved records
         /                    \
provider adapters       checks, review, Git

static landing + docs -> existing Vercel connection
                         (no workspace service)
```

Keep `src/core`, provider execution/contracts, neutral roles and lifecycle safety.
Add a terminal presentation layer, not another controller or registry. Consolidate
useful lower-level operations under the same executable. New products and small
existing-repository changes use the same core with an appropriate process depth.
Generated products may use any language; Foundry itself has one runtime.

Remove the Python runtime and Python build dependency after importing its useful
behavior and data handling; remove the `typed` switch, duplicate launchers,
browser workspace/settings/account screens, local HTTP server, MCP app bridge,
and shipped MCP entry point. Remove dependencies and tests only when their
removed surface has no remaining consumer. Port relevant safety regressions to
terminal/core tests rather than deleting checks to make the build pass.

## Migration and delivery order

1. Make one executable and npm build/start/typecheck/test/package checks. Build a
   minimal terminal interface for project selection, progress, review, exact
   approval, stop and recovery using the existing service.
2. Bring useful project/lifecycle commands under it; support scoped repository
   work without pretending that the complete new-product process occurred.
3. Add explicit TypeScript legacy import with inspection/dry-run, backup, exclusive
   ownership and crash recovery. Preserve settings, history and document bytes.
   Do not inherit approvals for changed content. Refuse unsupported or actively
   running projects without modifying them; never silently fall back to Python.
4. Separate public site assets from workspace code, remove obsolete runtime/UI
   paths, dependencies and commands, and update repository operating instructions.
5. Align README, built-in help, docs and CI around the single path. Test a packed
   npm artifact outside the checkout with no Python, no browser and no paid AI.

Keep the current source in Git history; do not ship it as an alternative runtime.
Do not touch unrelated untracked owner documents. No npm registry name or published
installation command is promised until availability and package contents are
verified; publishing remains a separate action.

## Documentation order

1. Start here: what Foundry does, installation, first project, existing repository.
2. Daily use: terminal controls/commands, planning, approvals, checks, stop/recovery.
3. Providers: setup, capabilities, support status, adding an adapter, billing.
4. Reference: configuration, project files, commands, troubleshooting, migration.
5. Architecture and contribution: diagram, module map, tests, release process.
6. Security, limitations, provenance and licenses.

Use one canonical Markdown source per topic. README is the short entry point,
not a second manual; the landing page links Install, Docs and GitHub. Preserve
the approved neutral visual direction. No product dashboard or account screens.

## Acceptance checks

- T-01: One npm-installed executable works outside the source checkout with Python
  unavailable. No `typed`, `ui`, MCP or hidden Python fallback execution routes.
- T-02: Terminal input/output tests cover selection, progress, review/approval,
  cancellation and recovery; noninteractive JSON is clean and never prompts.
- T-03: A local simulated adapter exercises the full product lifecycle and a
  scoped repository change; failed/missing checks and stale approvals block work.
- T-04: Imported project fixtures preserve owner data; active work, future schemas,
  conflicts, symlinks and interrupted imports fail safely or recover explicitly.
- T-05: Node-only build, typecheck and behavior tests pass. Required safety checks
  survive removal of obsolete interfaces. Packed files exclude credentials/state.
- T-06: Static site build and link/content checks pass independently of the
  runtime. Public links/help/docs show only the new path. No browser testing is
  run under this request; rendered/deployed behavior is explicitly not checked.
- T-07: Providers remain interchangeable through the same validated contract;
  fixture passes do not claim live qualification or OS sandbox enforcement.

## Exclusions

No new provider account connection, paid inference, automatic deployment or npm
publication. No visual redesign, browser test recording, recursive agent system
or universal-provider claim. Existing approvals, billing consent, cancellation,
bounded repairs, evidence, Git checkpoints and local-only Ship semantics remain.
