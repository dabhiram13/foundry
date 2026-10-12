# Build inside your coding client

Use Foundry inside **OpenCode**, with your existing model, account and coding
tools. Foundry prepares specialist assignments and saves the decisions and
evidence; it does not start another AI runtime.

**This is a source preview, not part of published npm 0.5.1.** Connection and
local protocol checks pass, but a real model-driven product trial remains
unqualified. Homebrew installation is not available.

```text
Your idea → Research → Plan → Your approval
         → Design → Your approval → Builders → Reviewer → Local handoff
```

For a small change, omit Research and Design and use the shorter
Planner → approved tasks → Builders → Reviewer path.

## 1. Build Foundry from source

You need Node.js 24 or newer, npm, Git and [OpenCode](https://opencode.ai/docs/).
Install and sign in to OpenCode through its own instructions. Foundry does not
choose a model or authorize account use for you.

These examples use a macOS/Linux shell. Run them in your computer's terminal,
not at the interactive `foundry>` prompt:

```sh
git clone https://github.com/dabhiram13/foundry.git
cd foundry
npm ci --ignore-scripts
npm run build:runtime
./foundry --help
```

The checkout must stay in place: the connection records its absolute launcher
and Node paths. This does not install a global `foundry` command. Windows users
can use the same Node program, replacing shell syntax and paths as appropriate;
this walkthrough does not claim Windows qualification.

## 2. Choose the product repository

Use an existing repository, or create a separate empty one. **Do not build the
demo inside the Foundry framework checkout.** For example, in another terminal:

```sh
mkdir habit-tracker
cd habit-tracker
git init
```

Return to the Foundry checkout for these commands. Replace `/absolute/path/to/habit-tracker`
with the full path to your product:

```sh
./foundry init --project /absolute/path/to/habit-tracker
./foundry connect opencode --project /absolute/path/to/habit-tracker --dry-run
```

Read the preview. It adds the local MCP connection and a project skill. It does
not start OpenCode or run a model. To accept those configuration changes:

```sh
./foundry connect opencode --project /absolute/path/to/habit-tracker --apply
```

Existing unrelated OpenCode settings are preserved; conflicting owner files are
not silently replaced. If initialization finds an unmarked older `.foundry`
directory, inspect the [migration guide](RUNTIME.md#explicit-legacy-import)
instead of deleting it.

## 3. Describe a small product

Open or restart OpenCode **from the product directory**. The project skill tells
the coding client how to use Foundry. A useful first request is:

> Use Foundry to build a small habit tracker web app. I can add a daily habit,
> mark it done today and keep progress after reloading. Use the full connected
> workflow with Research and Design. First inspect the project and configure
> real tests with inputs that cover the app. Create the brief and contract for
> me, including preparation. Show me the Plan and Design and stop for my terminal
> approval each time. Do not approve, publish or start another AI runtime for me.

The coding client should call `foundry_context` first, create the project-local
brief and contract with `preparation: {}`, then request the Research assignment.
You do not need to hand-author the internal JSON for this normal path.

An empty repository needs some setup: `init` does not invent tests or required
checks. The coding client must create real check scripts, configure them in the
project settings and map each requirement to a required check **before starting
the contracted run**. Every declared input path must exist. A zero-test command
or missing input is not meaningful product evidence. See
[check configuration](CUSTOMIZATION.md#checks-and-content).

Research selects one to five public HTTPS pages or permitted local documents.
You can supply a source, such as [MDN's localStorage guide](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).
Sources are captured before findings are submitted. Matching quotes show source
use, not source truth; local-only notes are not independent market research.
PDFs and pages requiring sign-in or JavaScript are not supported by the reader.

## 4. Review and approve twice

The client saves Research and the Plan, then stops. From a separate terminal in
the Foundry checkout, inspect the scope and configured commands:

```sh
./foundry work review --project /absolute/path/to/habit-tracker
```

Read the brief, findings, criteria, tasks and checks. If you accept them, replace
`HASH` with the exact revision printed by that review:

```sh
./foundry work approve --revision HASH --project /absolute/path/to/habit-tracker
```

Tell OpenCode to continue. It prepares the Design, including flows, states,
accessibility and validation. **Repeat review and approval for the new revision**
before building. Plan approval does not approve a Design that has not been saved.

Approval remains a separate terminal action, not an MCP tool. It records a local
workflow decision; it is not a security boundary against another process with
the same filesystem access.

## 5. Build, review and try the app

Builders work through the saved dependent tasks. Foundry runs configured checks
and records current evidence. A Reviewer covers each criterion; unfinished
tasks, failed checks and stale or blocking reviews prevent completion.

Ask the coding client to provide the app's start command and a local handoff.
Open the running app, add a habit, mark it done and reload. Check keyboard and
mobile behavior too. Passing unit tests and a text Design report do not prove
the rendered interface works or looks right. Your acceptance remains separate.

## Continue or remove the connection

Inspect current progress from the Foundry checkout:

```sh
./foundry work context --project /absolute/path/to/habit-tracker
```

In a new coding-client session, ask it to read `foundry_context` and continue the
saved run. Follow the reported pause, resume or recovery action; do not start a
replacement run or edit private state to hide an interrupted check.

If the checkout or Node installation moves, preview and apply the connection
again. To remove only Foundry's managed connection and skill:

```sh
./foundry connect opencode --project /absolute/path/to/habit-tracker --remove
```

No stage publishes an npm package or deploys your app. OpenCode's normal provider
costs and permissions still apply. Configured check commands run locally with
your privileges; Foundry is not a sandbox. See [security](../SECURITY.md),
[commands](COMMANDS.md#connect-opencode-to-scoped-work-source-preview) and
[live qualification](QUALIFICATION.md).
