<p align="center">
  <img src="https://foundry-two-tan.vercel.app/assets/foundry-banner.svg" alt="Foundry" width="960" />
</p>

# Build software from your terminal.

Start with an idea or an existing project. Foundry helps you plan, write code and
run checks, with your approval before building a new product.

**Open source · MIT licensed · Node.js 24 + TypeScript**

[Website][website] · [Docs][documentation-index] · [npm][npm-package] ·
[Contribute][contributing]

## Install

Requires **Node.js 24**, **npm** and **Git**.

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
- **Work happens in small tasks**, with checks, limited repair attempts and Git checkpoints.

Your code and history stay in your project. You can stop and recover work when
needed. **Ship writes a local summary; it does not publish or deploy.**
Small changes to an existing repository use a [shorter workflow][runtime].
See the [command reference][commands] for terminal controls and scripting.

## AI providers and your data

Foundry includes a Codex connector. **Install Codex and sign in separately**;
the [setup guide][getting-started] walks you through it. Other tools need a [provider adapter][providers]
to connect them.

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
