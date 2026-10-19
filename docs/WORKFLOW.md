# How Foundry works

**Foundry organizes the steps. Your coding tool or provider does the work.
You approve the plan and design.** Install it using the [first-project guide](GETTING-STARTED.md).

## The three parts

| Part | What it does |
| --- | --- |
| Foundry | Creates project folders, assigns work, saves results, runs checks and waits for approval. |
| Coding tool or provider | Uses its tools to research, plan and change code. Use your OpenCode model and account, or set up a provider for terminal work. |
| Your project | Holds the code, documents, Git history and private progress records on your computer. Cloud providers receive the prompts and project content sent to them. |

## What works today

Foundry is not yet a complete standalone coding agent. The connected workflow
uses your coding client's tools; internal session tests are not a replacement
for that client.

| Area | Available now | Still missing |
| --- | --- | --- |
| Product work | Research, Plan and Design approvals, dependent coding tasks, saved checks, review and local handoff through a compatible coding tool. | A current live-model product trial with owner visual acceptance and a same-brief one-shot comparison. |
| Providers | Terminal process adapters; the source connection uses OpenCode's selected model, account and tools. | A universal provider connection. A model API alone does not supply file, shell or browser tools. |
| Saved sessions | Internal typed session storage, command history, pause/stop and recovery tests. | A public managed coding-session command or app that runs real coding turns. |
| Code changes | The connected client edits files. A trusted internal test executor also exercises real edits and checks. | Connecting the managed OpenCode process to approved tasks, real model execution and recovery. |
| Terminal and browser | Use the host coding tool's tools. Foundry records supplied interface evidence. | A Foundry-owned interactive terminal, browser and isolated workspace. |
| Delivery | Local Git checkpoints and a handoff summary in terminal product work. | Foundry-managed PR creation, CI/review follow-up, merge and deployment. |
| Costs and credentials | Explicit adapter selection, billing consent and filtered process environments. Connected OpenCode owns its account and costs. | A unified credential manager or guaranteed live spending cap across providers. |
| Learning | Saved project progress and bounded repairs. | Evaluated cross-project skill learning or recursive self-improvement. |

The managed OpenCode check starts an authenticated local server, inspects an
empty project-bound session, deletes it and confirms shutdown. It sends no
prompt and does not prove active-tool cancellation or sandboxing. See
[architecture](ARCHITECTURE.md) and [test coverage](VALIDATION.md).

Passing local tests proves specific behavior, not parity with a complete coding
workspace or better product quality. The website is documentation, not a managed
workspace UI.

## Work inside your coding tool

Specialist roles are instructions for each job, not independent workers running
in parallel. They share the project's provider connection.

Inside an existing coding client, Foundry instead prepares assignments for the
host's own reasoning and tools. The connected source preview supports
Research → Planner → Plan approval → Designer → Design approval → relevant
Builders → Reviewer → local handoff. Add `preparation: {}` to a scoped contract
to enable this path. Research quotes captured sources; interface Design includes
a running preview and captured states, not just text. Tasks, artifacts and selected role policies
are part of the exact scope you approve. Smaller changes can omit preparation
and keep Planner → approved tasks → Builders → Reviewer. See
[connected work](COMMANDS.md#connected-specialist-work).
For setup and an owner-facing example, use [the connected-client guide](CONNECTED-CLIENT.md).
This connection is in the source code, not npm 0.5.1. The new visual workflow
has local test coverage, not a live-model trial. Homebrew is not available.

## What it is built with

The npm package is a prebuilt **Node.js 24+ program written in TypeScript**.
Running `foundry` opens its terminal interface. Longer shell commands call the
same core. It manages saved progress,
provider requests, checks and Git checkpoints.

The website is a separate **Astro/Starlight static site**, with React components
on the landing page.
See the [code layout](ARCHITECTURE.md) if you want to develop Foundry itself.

## Build a product from the terminal

```text
Your idea → Research → Plan → Your approval → Design → Your approval
         → Build → Test → Ship summary
```

| Stage | What you get |
| --- | --- |
| Research | Findings with captured sources, supporting quotes and limitations. |
| Plan | A proposed scope and criteria for deciding whether it works. You approve it. |
| Design | The implementation approach. You approve it before code is built. |
| Build | Small coding tasks, configured checks, limited repair attempts and Git checkpoints. |
| Test | Checks and a read-only review of the results against the plan. |
| Ship | A local summary of completed work and evidence. **No publishing or deployment.** |

Each explicit `foundry run PROJECT` performs one stage. Interactive `/run`
continues until an approval, completion or failure boundary. Status reflects
the saved stage, tasks, provider work, checks and review findings.

## Build and repairs

```text
Small task → Implement → Run required checks
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
             Pass                       Fail
               │                         │
        Git checkpoint          Exact receipt + check logs
               │                         │
          Next task             Repair, then check again
                                Up to three repairs
```

Each repair receives the failed receipt's path and hash, the tested input
revisions, and a compact list of required check failures. Repeated failures on
unchanged declared inputs prompt the agent to inspect the earlier result and
change approach. This is guidance, not proof of the cause. The three-repair limit
still applies, and a failed task stays incomplete.

## Research

Research has two AI turns, with a source-reading step between them:

1. The research role chooses one to five public HTTPS sources or local project
   documents using the tools available from your provider.
2. Foundry reads those sources, saves text snapshots with timestamps and hashes,
   and passes bounded excerpts back to the role. It does not run page scripts.
3. The role returns findings, supporting quotes and open questions. Foundry
   checks that every quote occurs in the supplied source excerpt, that snapshots
   have not changed, and writes the research report itself.

A URL alone, invented quotation or an entirely unavailable source set cannot
complete Research. A local-only report is allowed but explicitly marked as local
input, not independent market evidence. Unreadable sources and shortened excerpts
are recorded as limitations. Review the findings before approving the Plan:
matching a quotation does not prove the source is true or the interpretation valid.

Source reads are limited to public HTTPS on port 443, three redirects, 15 seconds
and 512 KiB per page. Private, loopback and reserved addresses are refused, including
after DNS lookup and redirects; connections use the validated address. Requests
carry no account cookies or authorization. HTML is converted to text without a
browser; PDFs, login-only pages and JavaScript-only content are not supported.
Only the first 6,000 characters of each readable source go to the synthesis turn.
Local sources are Markdown/text documents under `docs/`, or `README.md`; state,
hidden credential files, symlinks and the generated research report are excluded.

The report is `docs/product/research.md`. Source snapshots and structured results
are private records under `.foundry/state/factory/research/`. Cancellation keeps
available partial records and does not advance the stage; recovery and retry are
explicit. Retry selects and reads sources again rather than trusting partial work.

Source discovery uses the provider's tools. Research uses the same
[provider connection](PROVIDERS.md) as the other stages.

Connected Research uses the same reader and quotation checks, but saves artifacts
under the scoped run's `preparation/` directory rather than the adapter product's
Factory directory. The host performs source selection and synthesis, submitting
each result with the current snapshot. Connected interface Design also needs a
running preview in the real product app, a component/state map and captured
desktop/mobile views. Foundry freezes bounded local source and PNG copies for
approval. The host starts the preview and uses its browser tools; Foundry does
neither. The owner must look at the preview before approving the exact revision.
Review compares the running result with every approved view, alongside functional
checks. Files and reported observations are evidence to inspect, not proof of
good design or owner satisfaction. Service-only Design does not need a preview.
See the [preview contract](COMMANDS.md#interface-preview-and-visual-review).

## Scoped repository work

For a change in an existing repository, the shorter `work` commands track a
specification, run checks and record completion. **They do not dispatch an AI
to implement the change.** You or your coding tool make the changes between
`start` and `verify`. See [existing projects](RUNTIME.md).

To require scope approval, start with `--contract PATH`. The contract gives each
required criterion a stable ID and maps it to configured required checks. Read
`work review`, then explicitly approve its exact revision with
`work approve --revision HASH`. Verification records that approved revision;
completion requires current approval and matching passing evidence. Scope edits
require another approval. See the [contract format](COMMANDS.md#approve-a-scoped-change).

Start a scoped run with an existing local spec:

```sh
foundry work start SLUG --spec docs/specs/change.md --project /path/to/repository
foundry work context --project /path/to/repository
foundry work verify --project /path/to/repository
foundry work complete --project /path/to/repository
```

`verify` runs configured checks and reports nested active, check, review and
task state. `complete` records local completion only when evidence permits it.
Pause, resume, stop and recover are explicit. An interrupted or failed command
does not become a pass because a later command returned successfully.

Use `work context` when returning to a change or handing it to another coding
tool. It checks whether saved verification still matches the current work and
shows the next action. Add `--json` for structured context. `work status` shows
the saved lifecycle state, which may predate later edits.

The source-only [OpenCode connection](COMMANDS.md#connect-opencode-to-scoped-work-source-preview)
uses this same scoped state through local MCP tools. It does not launch Foundry's
provider adapters or approve on behalf of the owner. Client actions carry a
current context snapshot; manual approval is still through `work approve`.

## Roles and review

The neutral role catalog supplies instructions and permission requests to
providers. The owner controls approvals, billing and check rules. Read-only
review reports findings; owners or authorized implementers decide and repair.

See [saved workflow contracts](WORKFLOW-CONTRACTS.md),
[project customization](CUSTOMIZATION.md), and [provider capabilities](PROVIDERS.md).
