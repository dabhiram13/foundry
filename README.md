<p align="center">
  <img src="https://foundry-two-tan.vercel.app/assets/foundry-banner.svg" alt="Foundry" width="960" />
</p>

<p align="center">
  <a href="https://github.com/dabhiram13/foundry/actions/workflows/verify.yml"><img src="https://foundry-two-tan.vercel.app/assets/badge-ci.svg" alt="CI checks" /></a>
  <a href="https://www.npmjs.com/package/@dabhiram13/foundry"><img src="https://foundry-two-tan.vercel.app/assets/badge-npm.svg" alt="npm version" /></a>
  <a href="https://nodejs.org/en/download"><img src="https://foundry-two-tan.vercel.app/assets/badge-node.svg" alt="Node.js requirements" /></a>
  <a href="https://github.com/dabhiram13/foundry/blob/main/LICENSE"><img src="https://foundry-two-tan.vercel.app/assets/badge-license.svg" alt="MIT license" /></a>
  <a href="https://foundry-two-tan.vercel.app/docs/"><img src="https://foundry-two-tan.vercel.app/assets/badge-docs.svg" alt="Read the documentation" /></a>
</p>

# A product-building workflow for coding agents.

Start with an idea or an existing project. Foundry coordinates research,
planning, design, implementation and review through specialist roles, saved
progress and your approvals. Checks support the workflow; they are not the
whole product. The published CLI and the OpenCode source preview are separate
installation choices; the full connected specialist journey is still planned.

[Website][website] · [Docs][documentation-index] · [npm][npm-package] ·
[Contribute][contributing]

## Install

Requires **Node.js 24 or newer**, **npm** and **Git**.

```sh
npm install -g @dabhiram13/foundry
foundry
```

Run `foundry` from any directory.
Use `foundry --help` for commands and `foundry --version` to check your version.

**Next:** follow the [setup guide][getting-started] to connect a provider and
start a project. The guide also covers updates and uninstalling.

## How it works

**Foundry manages the steps. Your connected AI does the AI work. You approve
the decisions.**

For a new product:

```text
Research → Plan → Design → Build → Test → Ship
```

- **You approve the plan and design** before building starts.
- **Specialist roles focus on each step:** research, planning, design, coding and review.
- **Work happens in small tasks**, with checks, evidence-led repairs and Git checkpoints.
- **Each AI handoff is traceable**, with input hashes, role details and saved results.

Your code and history stay in your project. You can stop and recover work when
needed. **Ship writes a local summary; it does not publish or deploy.**
Small changes to an existing repository use a [shorter workflow][runtime].
See the [command reference][commands] for terminal controls and scripting.

### Connected coding client (source preview)

The source checkout can connect **OpenCode** to scoped repository work through
a local MCP server and project skill. OpenCode keeps your chat, model and account;
Foundry prepares specialist assignments, saves small dependent tasks, holds the
approved plan and records checks and review findings. The connected slice is
**Planner → saved tasks → relevant Builders → Reviewer → local handoff**.
It uses the host's reasoning or native subagents, not a second AI runtime.
Preview with `./foundry connect opencode
--project PATH --dry-run`, then apply with `--apply`. Approval remains a separate
terminal action. See [connection details][commands] and the precise limits.
**This connection is not in published version 0.5.1** and has not been
qualified with a live model. Existing terminal and provider workflows remain.

## AI providers and your data

Foundry connects to AI tools through provider adapters. **Choose your provider
and model**, then install and authorize its runtime separately. Follow the
[setup guide][getting-started] or the [adapter reference][providers].

Run `foundry providers` to inspect installed commands, declared capabilities and
configuration sources. Use `foundry providers PROJECT` to inspect a saved project
by its folder name or ID.

You confirm subscription use before running AI work. Cloud providers receive the
prompts and project content sent to them. Foundry is **not a sandbox**. Read the
[security guide][security].

## Check the framework

For contributors, after [setting up the source checkout][contributing]:

```sh
npm test
```

Runs runtime, package, static-site, tooling, catalog and secret checks with
local test data. See [architecture][architecture] for the code layout
and the [release guide][release-guide] for publishing.

## License

[MIT][license]. Adapted material retains its own notices; see
[third-party licenses][third-party-notices] and [origins][provenance].

[website]: https://foundry-two-tan.vercel.app/
[getting-started]: https://foundry-two-tan.vercel.app/docs/getting-started/
[npm-package]: https://www.npmjs.com/package/@dabhiram13/foundry
[documentation-index]: https://foundry-two-tan.vercel.app/docs/
[release-guide]: https://foundry-two-tan.vercel.app/docs/releasing/
[commands]: https://foundry-two-tan.vercel.app/docs/commands/
[contributing]: https://foundry-two-tan.vercel.app/docs/contributing/
[runtime]: https://foundry-two-tan.vercel.app/docs/runtime/
[providers]: https://foundry-two-tan.vercel.app/docs/providers/
[security]: https://foundry-two-tan.vercel.app/docs/security/
[validation]: https://foundry-two-tan.vercel.app/docs/validation/
[architecture]: https://foundry-two-tan.vercel.app/docs/architecture/
[license]: https://github.com/dabhiram13/foundry/blob/main/LICENSE
[third-party-notices]: https://foundry-two-tan.vercel.app/docs/notices/
[provenance]: https://foundry-two-tan.vercel.app/docs/provenance/
