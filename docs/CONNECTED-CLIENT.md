# Build inside your coding tool

Use Foundry inside **OpenCode**, with your existing model, account and coding
tools. Foundry assigns the work, saves progress and waits for your approval.

For an OpenAI-compatible or local model endpoint, configure it in OpenCode with
the [provider setup example](PROVIDERS.md#openai-compatible-endpoints-in-opencode).
Foundry keeps that provider configuration unchanged. A model API is not a
standalone Foundry coding engine; [managed execution is still unfinished](WORKFLOW.md#what-works-today).

**This connection is in the source code, not in npm 0.5.1.** The new visual
workflow has local test coverage, not a live-model trial. Homebrew is not available.

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
these commands have not been checked on Windows.

## 2. Choose the product repository

Use an existing repository, or create a separate empty one. **Do not build the
demo inside the Foundry framework checkout.** For example, in another terminal:

```sh
mkdir studio-booking
cd studio-booking
git init
```

Return to the Foundry checkout for these commands. Replace `/absolute/path/to/studio-booking`
with the full path to your product:

```sh
./foundry init --project /absolute/path/to/studio-booking
./foundry connect opencode --project /absolute/path/to/studio-booking --dry-run
```

Read the preview. It adds the local MCP connection and a project skill. It does
not start OpenCode or run a model. To accept those configuration changes:

```sh
./foundry connect opencode --project /absolute/path/to/studio-booking --apply
```

Existing unrelated OpenCode settings are preserved; conflicting owner files are
not silently replaced. If initialization finds an unmarked older `.foundry`
directory, inspect the [migration guide](RUNTIME.md#explicit-legacy-import)
instead of deleting it.

## 3. Describe a small product

Open or restart OpenCode **from the product directory**. The project skill tells
the coding client how to use Foundry. A useful first request is:

> Use Foundry to build a fitness studio booking app. Members browse classes,
> reserve an available place, change a booking and see confirmation. Cover
> mobile use, full classes, no bookings, loading, failures and retry. First agree
> on references and a design system with me. Use Research and Design, assign
> interface work to a UI specialist, and configure real tests. Show me the Plan
> for approval. Then build a running design preview in the real app and show its
> components and captured desktop/mobile states before Design approval. Compare
> the final running app with those approved views. Stop for my approval each time;
> do not approve, connect paid services or publish for me.

The coding client should call `foundry_context` first, create the project-local
brief and contract with `preparation: {}`, then request the Research assignment.
You do not need to hand-author the internal JSON for this normal path.

The coding client calls `foundry_setup` before starting new work. It previews
existing test/build scripts and their input paths. For an empty project, it
creates real scripts and tests first, then previews again. You review the
proposal; the client saves it through `foundry_apply_setup`, without you writing
check JSON. Existing checks are kept, and setup runs no commands or installs.

`init` does not invent an app, tests or required checks. The client must map
each requirement to a required check **before starting the contracted run**.
Every declared input path must exist. A zero-test command or missing input is
not meaningful product evidence. Non-package projects need custom checks. See
[check configuration](CUSTOMIZATION.md#checks-and-content).

To inspect and save detected checks yourself, use the source launcher:

```sh
./foundry setup --project /absolute/path/to/studio-booking --dry-run
./foundry setup --project /absolute/path/to/studio-booking --apply --revision HASH
```

Use the setup revision shown by the preview for `HASH`. This saves settings;
it does not approve a Plan or Design, run tests or claim they cover every need.

### Refresh an existing source connection

After updating and rebuilding the checkout, refresh the project's managed
runtime and skill. Owner settings and records stay in place:

```sh
./foundry init --project /absolute/path/to/studio-booking --update
./foundry connect opencode --project /absolute/path/to/studio-booking --dry-run
./foundry connect opencode --project /absolute/path/to/studio-booking --apply
```

Restart OpenCode in the product directory to load the updated tools.

Research selects one to five public HTTPS pages or permitted local documents.
You can supply a source, such as [MDN's localStorage guide](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).
Sources are captured before findings are submitted. Matching quotes show source
use, not source truth; local-only notes are not independent market research.
PDFs and pages requiring sign-in or JavaScript are not supported by the reader.

## 4. Review and approve twice

The client saves Research and the Plan, then stops. From a separate terminal in
the Foundry checkout, inspect the scope and configured commands:

```sh
./foundry work review --project /absolute/path/to/studio-booking
```

Read the brief, findings, criteria, tasks and checks. If you accept them, replace
`HASH` with the exact revision printed by that review:

```sh
./foundry work approve --revision HASH --project /absolute/path/to/studio-booking
```

Tell OpenCode to continue. It prepares the Design, including flows, states,
accessibility and validation. For an interface, the Designer builds a preview
inside the real app, with the adopted components and relevant empty, loading,
error and focus states. The host starts it and captures desktop/mobile views.
Foundry freezes source and image copies; it does not open a browser or start
the server itself. Look at the running preview and the saved views, not just
the written report. Request changes if the direction is weak.

**Repeat review and approval for the new revision** before implementation tasks.
Plan approval does not approve a Design that has not been saved. The preview is
a design slice, not permission to integrate production services before approval.
Missing browser evidence blocks the interface Design. See the
[preview contract](COMMANDS.md#interface-preview-and-visual-review) for limits.

Approval remains a separate terminal action, not an MCP tool. It records a local
workflow decision; it is not a security boundary against another process with
the same filesystem access.

## 5. Build, review and try the app

Builders work through the saved dependent tasks. Foundry runs configured checks
and saves the results. The UI specialist implements the approved design, while
other specialists handle their assigned work. The reviewer checks each requirement
and compares every approved screen/state/viewport with fresh captures from the
running app. Missing, unverified, stale or blocking visual evidence prevents
completion, even when functional tests pass.

Ask your coding tool for the app's start command and a summary of the work.
Open the running app, reserve a class, change the booking and inspect confirmation.
Try full classes, errors and retry. Check keyboard and mobile behavior too.
Passing tests, screenshots and a host-reported comparison do not prove the
interface is good. Your acceptance remains separate.

## Continue or remove the connection

Inspect current progress from the Foundry checkout:

```sh
./foundry work context --project /absolute/path/to/studio-booking
```

In a new coding-client session, ask it to read `foundry_context` and continue the
saved run. Follow the reported pause, resume or recovery action; do not start a
replacement run or edit private state to hide an interrupted check.

If the checkout or Node installation moves, preview and apply the connection
again. To remove only Foundry's managed connection and skill:

```sh
./foundry connect opencode --project /absolute/path/to/studio-booking --remove
```

No stage publishes an npm package or deploys your app. OpenCode's normal provider
costs and permissions still apply. Configured check commands run locally with
your privileges; Foundry is not a sandbox. See [security](../SECURITY.md),
[commands](COMMANDS.md#connect-opencode-to-scoped-work-source-preview) and
[live qualification](QUALIFICATION.md).
