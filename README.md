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

# Build from idea to product.

Foundry organizes research, planning, design, coding and review. Your connected
coding tool makes the changes. Foundry saves progress, runs your checks and
pauses for approval. Start with an idea or improve an existing project.

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

### Choose how to work

| Path | What you can do | What you use |
| --- | --- | --- |
| npm package, **0.5.1** | Run staged project work from the terminal | A compatible coding-tool adapter you set up |
| OpenCode, **from source** | Research, plan, design, build and review inside your coding tool | Your existing model and account |

The OpenCode connection is in the source code, **not in npm 0.5.1**. The new
visual workflow has local test coverage, not a live-model trial. Homebrew is not available. To try it, follow
[the OpenCode guide][connected-client].

**Foundry is not yet a complete standalone coding agent.** Its managed session
storage and OpenCode startup/shutdown checks are internal foundations, not a
working managed coding session. A built-in terminal/browser workspace and
automatic PR/CI follow-up are still missing. See [what works today][current-scope].

## How it works

**Foundry organizes the steps. Your coding tool or provider does the work.
You approve the plan and design.**

For a new product:

```text
Research → Plan → Design → Build → Test → Ship
```

- **You approve the plan and design** before building starts.
- **Specialist roles focus on each step:** research, planning, design, coding and review.
- **Work happens in small tasks**, with saved results and checks tied to current code.
- **Each role has a specific job.** Roles do not run all at once.
- **Decisions carry forward**, with the plan, design and review available to the next session.

Your code and history stay in your project. You can stop and recover work when
needed. **Ship writes a local summary; it does not publish or deploy.**
Small changes to an existing repository use a [shorter workflow][runtime].
See the [command reference][commands] for terminal controls and scripting.

### Use OpenCode from source

Build Foundry from source to use it inside **OpenCode**. OpenCode keeps your
chat, model and account. Foundry assigns the work, saves tasks and decisions,
waits for approval and records check results and review findings. The steps are
**Research → Plan approval → Design approval → relevant Builders → Reviewer → local handoff**.
Research saves sources and checks quotations. Interface Design includes a
running app preview, components and captured mobile/desktop states for your
approval. A named UI specialist implements it; review compares the result with
the approved views as well as checking behavior. Foundry saves the evidence,
not a judgment of good taste. Service work needs no images. Small changes can
skip Research and Design.
Your coding tool prepares the brief and tasks, then previews project checks.
For a new project, it creates real tests first. You do not write check JSON.
You review the connection before applying it, then approve Plan and Design in
your terminal. Follow [the OpenCode guide][connected-client].
Existing terminal and provider workflows remain available.

## Providers and your data

From the terminal, **choose your provider and model**, then follow its setup
and sign-in instructions. In OpenCode, keep your existing model and account.
Follow the [setup guide][getting-started] or the [provider reference][providers].

Run `foundry providers` to inspect installed commands, declared features and
configuration sources. Use `foundry providers PROJECT` to inspect a saved project
by its folder name or ID.

A model API URL alone is not a coding tool. For a custom endpoint, configure
your coding client first, then connect Foundry. Terminal adapters use a separate
process interface; they do not accept an arbitrary API URL. The [provider guide][providers]
explains both paths and what has been tested.

Using a subscription requires your consent. Cloud providers receive the
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
[connected-client]: https://foundry-two-tan.vercel.app/docs/connected-client/
[current-scope]: https://foundry-two-tan.vercel.app/docs/workflow/#what-works-today
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
