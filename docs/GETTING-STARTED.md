# Install and build your first project

You need [Node.js 24](https://nodejs.org/en/download) (which includes npm) and
[Git](https://git-scm.com/downloads).

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

## Connect the AI

Foundry organizes the workflow. **Codex performs the AI work** through Foundry's
built-in connector. Install and sign in to Codex separately.

If you already use Codex with your intended ChatGPT subscription, skip the
installation below. Otherwise, open another terminal and run:

```sh
npm install -g @openai/codex
codex
```

Follow [OpenAI's sign-in instructions](https://developers.openai.com/codex/auth/)
and choose your subscription account. Close Codex after signing in, then
return to Foundry. Your provider's usage limits still apply. Do not paste
passwords or API keys into Foundry commands or project files.

The standard Foundry project flow uses subscription or local providers, not
API-key billing. Other providers require a working connector; see
[provider setup](PROVIDERS.md).

## Create a project

Inside Foundry, type these commands one at a time:

```text
/new reading-list --idea "Save links and mark them read"
/use reading-list
```

`--idea` supplies your description. Replace the name and description with your
own idea. `/new` creates a project folder; `/use` selects it. Neither starts AI.
New projects are saved under `~/.foundry/products` in your home folder.

Confirm that this project may use your signed-in subscription:

```text
/configure --billing subscription --confirmed
```

This records permission to use your subscription for this project.
Check that Codex is signed in to the account you intend to use before confirming.

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
- **Already have a repository?** Follow [existing projects](RUNTIME.md). Those
  commands track and check a change; they do not automatically run the new-product AI workflow.
- **Want shell commands or scripts instead?** Use the [command reference](COMMANDS.md).
- **Want to change Foundry itself?** Use [contributor setup](../CONTRIBUTING.md).
