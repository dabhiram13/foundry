# Catalog

Choose workflows and references for the task at hand:

- 37 workflow skills under `.agents/skills/` for planning, building, checking, and maintaining products.
- 28 specialist roles under `.codex/agents/`, using your configured model.
- 67 optional skills under `library/skills/`. Read them as needed or enable selected skills for a product.

## Workflow skills

`foundry-analytics`, `foundry-audit`, `foundry-blog`, `foundry-deep-interview`, `foundry-deploy`, `foundry-design`, `foundry-discover`, `foundry-domain`, `foundry-drift`, `foundry-emails`, `foundry-enhance`, `foundry-finish`, `foundry-fix-issue`, `foundry-fumadocs`, `foundry-heal`, `foundry-help`, `foundry-landing-design`, `foundry-logo`, `foundry-monitor`, `foundry-mvp-build`, `foundry-mvp-spec`, `foundry-payments`, `foundry-pentest`, `foundry-performance`, `foundry-rate-limit`, `foundry-resume`, `foundry-schema-sync`, `foundry-security`, `foundry-sentry`, `foundry-seo`, `foundry-settings`, `foundry-setup`, `foundry-skeleton`, `foundry-spec`, `foundry-start`, `foundry-trace`, and `foundry-verify`.

Use Codex's skill picker or name a skill with `$foundry-…`. These workflows run only when explicitly requested and use `scripts/foundry.py` to track work and record checks.

## Roles

Roles give Codex instructions for a specific job, such as planning, implementation, or review. Analysis roles have read-only access; implementation roles use the project's normal permissions.

## Reference library

Run `python3 scripts/foundry.py enable-skill NAME` to copy one library skill into `.agents/skills/NAME`. Existing destinations are never overwritten. Service-specific skills describe optional application integrations.

The 101 supporting architecture documents used by the native roles live under
`.foundry/references/source-docs/`: 64 product patterns, 10 Supabase references, and 27 tool
catalog and Inngest references. Active roles use these installed paths, so they do not depend
on another checkout. Follow the product's requirements and current specification when using these guides.

Reusable guides for auth, billing, design systems, landing pages, legal pages, and
onboarding are in `.foundry/workflows/`. Optional SQL setup scripts are in
`.foundry/migrations/`. Use them when the selected product stack needs them.

Bundled source information is recorded in `library/provenance.json`; license files
remain beside their skills.
