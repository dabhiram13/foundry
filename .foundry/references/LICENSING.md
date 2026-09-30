# Archived upstream licensing notes

This file preserves the licensing explanation supplied with BuildThisNow CodeKit 0.3.0 as
historical evidence. It describes that vendor's distribution, commands, and services at the
time of delivery; it is not Product Foundry runtime guidance or a statement of current terms.
For this repository's licenses and redistribution notices, read `LICENSE`,
`THIRD_PARTY_NOTICES.md`, `.foundry/LICENSE-framework`, and the license files retained beside
vendored library skills.

# Licensing — what is gated, what is open, what a customer may do

Factual, and current as of 0.3.0. The legal text is `LICENSE.md` (MIT) and nothing here adds to it.

## Three SKUs, one payload

Every route downloads the **same** signed payload from the same licence server. What differs is
where the harness ends up and which command puts it there.

| | npm copy — `init --copy` | Claude Code plugin — `init` (default) | Codex — `init`, either mode |
|---|---|---|---|
| Install | `login` → `init --copy` | `login` → `init` → `claude`, accept the prompt | `login` → `init --copy` — plugin-mode `init` gives Codex the skills and agents but not the hooks (see the Hooks row) |
| Where the harness lives | `.claude/` inside the project | `~/.buildthisnow/plugin/<version>/.claude`, copied into Claude Code's own plugin cache | `.codex/` + `.agents/skills/` inside the project |
| What `init` writes into the project | everything: `.claude/ .agents/ docs/ .githooks/ .codex/` + `scripts/verify.sh`, `AGENTS.md`, … | `PROJECT_TREES` only — `.agents/ docs/ .githooks/ .codex/` + the same managed files, plus a composed `.claude/settings.json` and `.claude/state/` | same as the column that ran |
| Licence checked | at `init` and `update` | at plugin install, at plugin update, **and once per session in the background** | at `init` and `update` |
| Updates reach the customer | only when they run `npx buildthisnow update` | on their own: the background re-run fetches a new payload, Claude Code sees a new content hash and offers `/reload-plugins` | `npx buildthisnow update` |
| Agents · commands · skills | 28 · 34 · 60 | 28 · 34 · 60 | 28 `.codex/agents/*.toml` · 34 `codekit-*` skills · 60 skills |
| Hooks | `.claude/settings.json` `hooks` block | `.claude/hooks/hooks.json`, paths on `${CLAUDE_PLUGIN_ROOT}` | `.codex/hooks.json` — runs the scripts in `.claude/hooks/`, which only a copy install puts on disk; inert until the project is trusted and the user approves the list via `/hooks` |
| Command names | `/start` | `/codekit:start`; the bare `/start` also resolves while no other plugin or project command claims that name | `$codekit-start` |
| Project instructions | `/start` composes `CLAUDE.md` | same | root `AGENTS.md`, which Codex reads natively |

`.claude/hooks/harness-root.sh` is what lets one tree serve all of them: harness assets resolve
under `HARNESS_ROOT`, project state under `PROJECT_ROOT`, and in the copy layout those are the same
directory.

## The gate

`lib/license.js`, in order:

1. Resolve the key — `--key` → `$BUILDTHISNOW_KEY` → the cache at `~/.buildthisnow/config.json`
   (written `0600`) → an interactive prompt.
2. Compute a stable machine fingerprint.
3. `POST /cli-validate { key, fingerprint, hostname, platform }` against the Supabase edge base in
   `lib/constants.js` (`BUILDTHISNOW_EDGE_BASE` overrides it).
4. Cache the result. Re-validate after 24 hours; on a network failure inside that window, run on the
   cached validation and warn.

`npx buildthisnow login <KEY>` is the one command a customer runs per machine; it does nothing but
step 1–4 and print the masked key, tier and machine count. `npx buildthisnow logout` calls
`/cli-deactivate` to free the seat and deletes the cache. `npx buildthisnow license` reports status.
The three `/cli-*` functions are deployed but are **not** in this repo — see
`dev/active/harness-v2/phases/phase-0-provenance.md`.

The payload itself comes from `POST /cli-payload`, which returns a signed URL plus the sha256; a
hash that does not match aborts before anything is extracted.

The gate protects **delivery of the payload**, not the code once delivered. The code is MIT. A
customer who has the payload may read it, modify it, and use it in their own products. Nothing
phones home after install — the only network calls in the tree are in `lib/license.js` and
`lib/payload.js`, both of which run under `npx buildthisnow`, never inside a session.

## The plugin gate: a `command` source

`.claude-plugin/marketplace.json` declares one plugin whose source is:

```json
{ "source": "command", "command": "npx -y buildthisnow@latest plugin-path", "timeout": 180, "mode": "copy" }
```

`plugin-path` (`lib/plugin.js`) validates the licence, makes sure `~/.buildthisnow/plugin/` holds
the payload the server is currently serving, and writes **one line to stdout**: the absolute path of
`<version>/.claude`. Claude Code copies that directory. Everything human-readable goes to stderr.

- No licence on the machine ⇒ exit 1 with *"run `npx buildthisnow login <KEY>`"*, and the install
  or update fails. Expired, suspended, cancelled, refunded, over the machine limit ⇒ the same.
- The request carries `currentSha256`, the hash the cache already holds, so the ordinary session is
  answered `{upToDate:true, version, sha256, sizeBytes, minCli}` and no signed URL is minted at all.
  A payload is downloaded only when `/cli-payload` reports a version+sha256 the cache does not
  already hold — which is what makes the once-per-session re-run cheap. An older server that does
  not know the field still answers with a signed URL, and the client's own comparison skips the
  download just the same.
- A new payload is a new directory ⇒ a new content hash ⇒ Claude Code offers `/reload-plugins`.
  This is the first route on which "lifetime updates" is true without the customer thinking of it.

### Why not the alternatives (verified 2026-08-30 against `code.claude.com/docs`)

| Mechanism | Verdict |
|---|---|
| `headersHelper` (v2.1.238+) | Only for `archive` plugin entries and `url` marketplaces. Env vars whose name contains `KEY`/`TOKEN`/`SECRET`/`AUTH` are **stripped** before the helper runs when it is declared in `marketplace.json`, and auto-update skips any entry that declares one — so it would gate the first install and then stop updating. Needs a new edge function that streams the archive. **Rejected.** |
| `source: "command"` (v2.1.229+) | Re-runs on install, on update, once per session in the background, and whenever the enabled version is missing from the cache; non-zero exit fails the install; the plugin version becomes a 12-char content hash. **Chosen.** |
| `metadata` | Free-form and inert. Used only to label the entry `licence: required` and name the `login` command. |
| `userConfig` + `sensitive` | Would store the key in the keychain for hooks and MCP — i.e. put a licence check *inside* a session. No hook in this harness makes a network call, and that stays true. Not used. |
| Private git / npm source | Works via credential helpers, but gates access to a *repo*, not to a *licence*, and background auto-update drops credential helpers over HTTPS. Not used. |

## What a lapsed licence does

It stops **updates**, not the harness.

- The copy Claude Code already made stays in its plugin cache; the documented behaviour is that the
  plugin stays at its installed version. Only the background refresh fails.
- `.claude/hooks/license-notice.sh` (`SessionStart`, no network) reads `~/.buildthisnow/config.json`
  and says so in one line: expired ⇒ names the date and `buildthisnow.com/protected/codekit`;
  not validated for 14+ days ⇒ names `npx buildthisnow login`. It never reads or prints the key.
- `npx buildthisnow init`, `update` and `plugin-path` all refuse until the licence is good again.
- Existing 0.2.x copy installs are untouched by any of this. `init --copy` and `update` behave
  exactly as they did; `update --to-plugin` is opt-in, lists the unmodified harness files it would
  delete, and keeps anything you edited.

## The two things a plugin still cannot ship

1. **`permissions`.** A plugin's own `settings.json` honours only `agent` and `subagentStatusLine`.
   So `npx buildthisnow init` writes the project's `.claude/settings.json` itself — the `allow` list
   plus the eight-entry `deny` list (`git rebase`, `git reset --hard`, `git push --force`,
   `git push -f`, `git filter-branch`, `git filter-repo`, `git reflog expire`,
   `npx shadcn@latest … --overwrite`) — and merges rather than clobbers an existing file.
   Belt and braces: `.claude/hooks/guardrails.sh` is a `PreToolUse` hook that denies the same eight
   shapes, and it ships **inside the plugin**, so the guardrail exists even on a bare
   `claude plugin install` with no `init`.
2. **`core.hooksPath = .githooks`.** Only a `git config` call can set it, so `init` does it, in both
   modes, whenever the project has a `.git/`. That is what makes `scripts/verify.sh --staged` run at
   pre-commit.

Neither can be fixed by a better manifest; that is why `init` remains part of the plugin route
rather than an alternative to it. The same is true of the files a plugin has no component type for —
`scripts/verify.sh`, `.githooks/`, `docs/`, `AGENTS.md`, `.agents/` and `.codex/`.

## The dev route

From a clone of this repo, no licence and no install:

```bash
claude --plugin-dir ./.claude
```

`.claude/` is already a valid plugin root (`.claude/.claude-plugin/plugin.json`,
`hooks/hooks.json` on `${CLAUDE_PLUGIN_ROOT}`), which is why the same directory serves the dev
route, the copy layout and the payload the `command` source hands over.
