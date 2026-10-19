# Install and build your first project

You need [Node.js 24 or newer](https://nodejs.org/en/download) (which includes npm) and
[Git](https://git-scm.com/downloads).

This guide uses **npm 0.5.1** with a provider you choose. Already using OpenCode?
See the separate [OpenCode source guide](CONNECTED-CLIENT.md), which uses your
existing model and account. That connection is not in npm 0.5.1.

## Install Foundry

Run these two commands in your computer's terminal:

```sh
npm install -g @dabhiram13/foundry
foundry
```

The first installs Foundry. The second opens it. `-g` makes the command
available from any folder.

When you see `foundry>`, you are **inside Foundry**. Commands there start with
`/`. Type `/help` for help
or `/exit` to return to your computer's terminal.

## Choose a provider

Foundry organizes the steps. **The provider you choose does the work.** An
adapter is the connection that lets Foundry use that provider's tools.

Inside Foundry, list the available connections:

```text
/providers
```

Choose an adapter that supports project work. Install its runtime and follow
the provider's sign-in instructions in another terminal. The
[provider guide](PROVIDERS.md) covers the bundled connection and adding others.
An installed executable still needs the right account access. Keep passwords
and API keys out of Foundry commands and project files.

Project workflows use local or subscription-backed adapters. An arbitrary AI
CLI or API key needs a compatible adapter before Foundry can use it.
For a custom model endpoint, use the [coding-client path](CONNECTED-CLIENT.md)
and configure the endpoint there. Foundry does not turn a raw model API into a
coding agent. See [what works today](WORKFLOW.md#what-works-today).

## Create a project

Inside Foundry, type these commands one at a time:

```text
/new reading-list --idea "Save links and mark them read" --adapter PROVIDER
/use reading-list
```

Replace `PROVIDER` with the adapter name from `/providers`. `--idea` supplies
your description. `/new` creates a project folder; `/use` selects it. Neither starts AI.
New projects are saved under `~/.foundry/products` in your home folder.

For a subscription-backed adapter, confirm that this project may use your account:

```text
/configure --billing subscription --confirmed
```

This records permission to use your subscription for this project.
Check that your provider is signed in to the account you intend to use before
confirming. Local adapters do not need subscription consent.

Foundry leaves model selection to the provider unless you set `--model MODEL`
when creating or configuring a project. Use a model name supported by that adapter.

## Run and approve the work

Start the workflow:

```text
/run
```

Wait for the project to reach its approval step. Foundry researches the idea
and writes a plan, then pauses. The prompt shows the current stage and status.
Read the plan:

```text
/review
```

If you accept what you read, approve it and continue:

```text
/approve
/run
```

Foundry next prepares the design and pauses again. Use `/review`, read it,
then `/approve` and `/run` when satisfied. Approval applies to the exact
document you reviewed in this terminal; changed documents need another review.
To change a plan, edit the saved document in your editor and review it again
before approving.

After both approvals, Foundry builds in small tasks, runs checks and attempts
limited repairs. It stops if work fails or needs recovery. The final **Ship**
step writes a local summary; **it does not publish or deploy your project**.
See [how Foundry works](WORKFLOW.md) for what each stage does.

Use `/stop` to interrupt work, `/projects` to list projects and `/exit` to
leave. To return later, open `foundry`, then `/use reading-list`. Interrupted
work may need `/recover` before `/run`.

## Update or uninstall

Stop active work first. Run these in your computer's terminal, not inside Foundry.
To update, use the same install command:

```sh
npm install -g @dabhiram13/foundry
```

Check the installed version with `foundry --version`. To remove the command:

```sh
npm uninstall -g @dabhiram13/foundry
```

Uninstalling does not delete your projects. Back up important projects before
changing versions.

## Troubleshooting and next steps

- **Command not found or permission error:** use a Node version manager or a
  user-writable npm installation; do not retry with `sudo`. See npm's
  [installation permissions guide](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally).
- **Previously used `npm link`:** run `npm unlink -g @dabhiram13/foundry` before
  installing the published package. Keep any edits in your source checkout.
- **Already have a repository?** Follow [existing projects](RUNTIME.md) for manual
  scoped work, or [connected work](CONNECTED-CLIENT.md) inside OpenCode. Neither
  silently starts the adapter-driven new-product workflow in that repository.
- **Looking for Homebrew?** No tap or formula is available yet. Use npm for the
  published CLI, or the source preview for the coding-client connection.
- **Want shell commands or scripts instead?** Use the [command reference](COMMANDS.md).
- **Want to change Foundry itself?** Use [contributor setup](../CONTRIBUTING.md).
