# Your first product with Foundry

Foundry helps you work from an idea to code and tests on your own computer.
You approve the plan and design before it builds. Start with one small product;
you do not need to learn every role or command.

**Today:** install from this repository and launch a local browser workspace.
There is no published `npm install foundry` package or complete terminal-only
workflow. The public landing page is not a hosted place to run your projects.

## 1. Check your computer

You need:

- **macOS or Linux.** Foundry's launcher is not qualified on native Windows.
- **Python 3.11 or newer**, available as `python3`, with `venv` and pip support.
  See [Python downloads](https://www.python.org/downloads/). Some Linux systems
  package `venv` separately; install the package for your Python version.
- **Git.** See [Git installation](https://git-scm.com/downloads).
- **Codex CLI.** Follow [OpenAI's installation guide](https://developers.openai.com/codex/quickstart).
  It offers standalone, npm and Homebrew installation options. Foundry's built-in
  route expects a ChatGPT subscription login, not metered API billing.
- Access to the Foundry repository. If it is private, sign in to GitHub with an
  account that has access before cloning it. Do not put a token in the clone URL.

Check the commands in your terminal:

```sh
python3 --version
git --version
codex --version
```

Make sure the first command reports **3.11 or newer**. Merely having another
Python version installed is not enough: the launcher uses `python3`.
You do not need Node to open the prebuilt Foundry app. Developers rebuilding
the interface need Node 22+; that is a separate setup.

## 2. Install and open Foundry

In the folder where you keep projects, run:

```sh
git clone https://github.com/dabhiram13/foundry.git
cd foundry
./foundry
```

The first launch creates a private Python environment in the Foundry folder and
downloads its Python dependencies. It then opens `http://127.0.0.1:8765` in your
browser. If the browser does not open, visit that address yourself. Keep the
terminal running while you use the workspace.

If you already cloned Foundry, open that folder and run `./foundry` instead of
cloning it again. There is no Foundry account to create.

For another port or product location:

```sh
./foundry --port 8766
./foundry --products-dir /absolute/path/to/my-products
```

Choose the folder intentionally: generated projects and their Git history live
there. By default, Foundry uses a sibling `products` folder next to its checkout.

## 3. Connect Codex

In a **second terminal**, run:

```sh
codex login
```

Complete the ChatGPT sign-in flow. If you are already signed in, you can inspect
the login with `codex login status`. Check that this is the subscription account
you intend to use. Do not paste credentials into the product idea or documents.

Codex is the built-in engine. You do not need to also select **Continue with
ChatGPT** in Foundry: that is a separate, experimental connection that currently
requires macOS Keychain. On macOS, Foundry prefers the Codex desktop app's
executable when available; use `FOUNDRY_CODEX` if you need to explicitly select a
different installed executable. See [AI engine details](PROVIDERS.md).

Foundry does not inspect your bill or guarantee free/unlimited usage. Your
provider's plan and limits still apply. It does not silently switch to paid API
usage when your subscription is unavailable.

## 4. Create your first product

1. Select **Open workspace**.
2. Give the product a name and describe one useful job. For example:
   “A small reading list where I can add a link, mark it read and filter unread
   items. Keep it local; no accounts or payments for this first version.”
3. Select **Create product**. This creates its folder; it does not authorize
   publishing or connecting paid services.
4. Select **Confirm AI login**. Under **AI**, keep **Codex (your login)** selected,
   check **Use my existing Codex subscription login. Do not use metered API
   billing.**, then select **Save settings**. Confirm only if that is the login
   you configured. This is your confirmation, not a billing check by Foundry.
5. Select **Start Research**. This starts actual AI work and uses your plan.

AI settings are per product and appear after you create one. Leave model and
reasoning settings at their defaults unless you have a specific reason to change
them. Switching engines clears the subscription confirmation.

## 5. Review, build and check

| Step | What you do | What Foundry saves |
| --- | --- | --- |
| Research | Check the problem and assumptions | Research notes |
| Plan | Read and approve the proposed first version | The approved plan |
| Design | Read and approve the proposed experience | The approved design |
| Build | Follow the tasks; intervene if help is needed | Code, checks and a Git checkpoint per completed task |
| Test | Review what passed and what was not checked | Test results |
| Ship | Review the final summary and choose what to do next | A summary of the work and remaining gaps |

If an approved plan or design changes, Foundry asks you to approve it again.
Build runs real checks after each task. Failing checks get up to three repair
attempts before Foundry stops and asks for help. Passing tests do not replace
trying the finished product yourself.

Your product lives in its own folder, not inside the Foundry source. Its code,
notes, test results and Git history stay together. The product's own instructions
explain how to run it; there is no single preview command that fits every stack.

**Ship does not deploy anything.** Hosting, payments, public publishing and other
external services are separate decisions you make.

## Come back to your work

Use **Stop** to cancel an active step and wait for its status to settle before
closing the server. Press `Ctrl+C` in the server terminal when you are finished.
Next time, run `./foundry` from the same checkout with the same product-location
options, open **Your products** and select the project. Use the next action shown
on its page; if a step failed, read the error before selecting **Try again**.

For updating an existing checkout, first stop work and save any local changes,
then run `git pull --ff-only` from the Foundry folder. If Git reports a conflict
or divergent history, stop rather than resetting your changes. Run `./foundry`
again; it installs changed Python dependencies when needed.

## When something goes wrong

| What you see | What to check |
| --- | --- |
| `python3` is missing or too old | Install/select Python 3.11+ and check `python3 --version` in the same terminal. |
| Python environment creation fails | Check that this Python installation includes `venv` and pip. |
| Repository not found / permission denied while cloning | Check the repository URL and your GitHub access. A private repo is not publicly installable. |
| `codex` is missing | Follow the official Codex install guide, reopen your terminal and check `codex --version`. |
| Sign-in or subscription confirmation blocks a run | Check `codex login status`, then the product's AI settings. Do not tick consent to bypass a different billing setup. |
| ChatGPT connection fails on Linux | Use the existing Codex login route. Foundry's separate ChatGPT connection needs macOS Keychain. |
| Port 8765 is already in use | Start with `./foundry --port 8766` and use the address printed by the server. |
| A product check fails | Read the actual command and error on the product page. Fix missing tools or configuration, then try again. |
| Work was interrupted | Reopen the same project and inspect its status. See [recovery details](RUNTIME.md); do not edit saved state files by hand. |

## AI support and privacy

Codex is the built-in engine; the separate ChatGPT connection is experimental.
Claude, Qwen and other engines are **not** automatically supported by entering a
model URL. They need an integration that runs tools, reports progress, respects
permissions and can stop safely. An OpenAI-compatible model response is only one
part of that system. See [provider contracts](PROVIDERS.md) for advanced setup.

Local files do not mean local inference. A cloud AI receives prompts and selected
project content. Keep secrets out of prompts, use only accounts you authorize,
and review your provider's data policies.

Automated local tests use simulated AI. They do not establish successful native
AI execution, account billing, hosted integrations or public deployment. See
[what has been checked](VALIDATION.md) for the limits.

[Back to documentation](README.md) · [Foundry overview](../README.md)
