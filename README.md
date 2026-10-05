<p align="center">
  <img src="https://raw.githubusercontent.com/dabhiram13/foundry/main/site/assets/foundry-banner.svg" alt="Foundry" width="960" />
</p>

# Build software from your terminal.

Start with an idea or an existing project. Foundry helps you plan, write code and
run checks—with your approval before building a new product.

**Open source · MIT licensed · Node.js 24 + TypeScript**

[Get started][getting-started] · [Documentation][documentation-index] ·
[Release process][release-guide] · [Contribute][contributing]

## How it works

```text
Research → Plan → Design → Build → Test → Summary
             ↑       ↑
          You approve
```

- **Plan first.** Review the plan and design before a new product is built.
- **Build in small steps.** Run checks, repair failures and save completed tasks in Git.
- **Use focused specialists.** Roles cover research, planning, design, coding and review.
- **Keep your code and history.** Work stays in your project. Stop and recover when needed.

Small changes to an existing repository use a [shorter workflow][runtime].
The final stage, called **Ship** in the CLI, writes a local summary—it does not
publish or deploy.

## Install the CLI

Requires **Node.js 24**, **npm** and **Git**. No Foundry account needed. The
commands use a POSIX shell; package checks have local Linux evidence, while
macOS and native Windows remain unqualified. Install the CLI from npm:

```sh
npm install --global --ignore-scripts @dabhiram13/foundry
foundry
```

After setup, run `foundry` from any directory to open the interactive terminal.
Use `foundry --version` to check the installed version and [commands][commands]
for scripts. No source checkout, website build or AI work is needed to install.

Follow the [setup guide][getting-started] to connect a provider and start your
first project, update or uninstall. Find releases on [npm][npm-package]. To
change Foundry itself, see [contributor setup][contributing].

## AI providers and your data

Codex is built in. Developers can connect other tools through
[provider adapters][providers]; an API key alone is not enough.
Other live providers and native Windows remain unqualified.

You confirm subscription use before running AI work. Cloud providers receive the
prompts and project content sent to them. Local files do not mean local AI
processing, and Foundry is **not a sandbox**. Read the [security guide][security]
and [tested behavior and limits][validation].

## Check the framework

```sh
npm test
```

Runs runtime, package, static-site, tooling, catalog and secret checks with local
fixtures—not paid AI. See [contributing][contributing] for development guidance
and [architecture][architecture] for how the pieces fit together.

## License

[MIT][license]. Adapted material retains its own notices; see
[third-party licenses][third-party-notices] and [origins][provenance].

[getting-started]: https://github.com/dabhiram13/foundry/blob/main/docs/GETTING-STARTED.md
[npm-package]: https://www.npmjs.com/package/@dabhiram13/foundry
[documentation-index]: https://github.com/dabhiram13/foundry/blob/main/docs/README.md
[release-guide]: https://github.com/dabhiram13/foundry/blob/main/docs/RELEASING.md
[commands]: https://github.com/dabhiram13/foundry/blob/main/docs/COMMANDS.md
[contributing]: https://github.com/dabhiram13/foundry/blob/main/CONTRIBUTING.md
[runtime]: https://github.com/dabhiram13/foundry/blob/main/docs/RUNTIME.md
[providers]: https://github.com/dabhiram13/foundry/blob/main/docs/PROVIDERS.md
[security]: https://github.com/dabhiram13/foundry/blob/main/SECURITY.md
[validation]: https://github.com/dabhiram13/foundry/blob/main/docs/VALIDATION.md
[architecture]: https://github.com/dabhiram13/foundry/blob/main/docs/ARCHITECTURE.md
[license]: https://github.com/dabhiram13/foundry/blob/main/LICENSE
[third-party-notices]: https://github.com/dabhiram13/foundry/blob/main/THIRD_PARTY_NOTICES.md
[provenance]: https://github.com/dabhiram13/foundry/blob/main/docs/PROVENANCE.md
