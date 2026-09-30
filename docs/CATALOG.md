# Catalog

Product Foundry ships a Codex-native catalog with three layers:

- 37 explicit workflow skills under `.agents/skills/`: 34 migrated source recipes plus native `foundry-resume`, `foundry-verify`, and `foundry-finish` lifecycle skills.
- 28 optional subagent roles under `.codex/agents/`. They inherit the user's model; none pins a model.
- 67 reference skills under `library/skills/`: the 60 shared source skills and seven optional Codex/Ralph additions. They are inert until enabled or read directly.

## Workflow skills

`foundry-analytics`, `foundry-audit`, `foundry-blog`, `foundry-deep-interview`, `foundry-deploy`, `foundry-design`, `foundry-discover`, `foundry-domain`, `foundry-drift`, `foundry-emails`, `foundry-enhance`, `foundry-finish`, `foundry-fix-issue`, `foundry-fumadocs`, `foundry-heal`, `foundry-help`, `foundry-landing-design`, `foundry-logo`, `foundry-monitor`, `foundry-mvp-build`, `foundry-mvp-spec`, `foundry-payments`, `foundry-pentest`, `foundry-performance`, `foundry-rate-limit`, `foundry-resume`, `foundry-schema-sync`, `foundry-security`, `foundry-sentry`, `foundry-seo`, `foundry-settings`, `foundry-setup`, `foundry-skeleton`, `foundry-spec`, `foundry-start`, `foundry-trace`, and `foundry-verify`.

Each has `agents/openai.yaml` with `allow_implicit_invocation: false`. Invoke one deliberately from Codex's skill picker or by naming it. Every active skill contains native operational behavior and defers lifecycle state to the runtime. Historical recipes under `.foundry/references/commands/` are inert provenance and may contain obsolete harness commands; active skills never direct Codex to execute them.

## Roles

The agent TOMLs are optional specialist prompts. Read-only analysis roles keep a read-only sandbox; implementation roles use the repository's normal sandbox. Their instructions point to `.foundry/philosophy/` and `library/skills/` and use native file search, reads, edits, and shell terminology.

## Reference library

Run `python3 scripts/foundry.py enable-skill NAME` to copy one library skill into `.agents/skills/NAME`. Existing destinations are never overwritten. Provider-specific skills such as `claude-api` document that provider's API; they do not change Product Foundry's Codex-native runtime.

The 101 supporting architecture documents used by the native roles live under
`.foundry/references/source-docs/`: 64 product patterns, 10 Supabase references, and 27 tool
catalog and Inngest references. Active roles use these installed paths, so they do not depend
on the upstream checkout or a vendor CLI. They are reference material; project requirements
and the active runtime spec remain authoritative.

See `.foundry/references/PROVENANCE.md` and `.foundry/references/skills-lock.json` for origin and licensing evidence.
