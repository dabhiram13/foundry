# Setup Manifest Generator — Spec

> After discovery completes, generate `setup-manifest.json` at the project root.
> The dashboard reads this file to render a dynamic, project-specific setup wizard.
> The dashboard code NEVER changes — only the manifest data drives what steps appear.

## When to Generate

Generate `setup-manifest.json` at the END of discovery (Phase 6), after:
- All `docs/project/` files are written
- `docs/project/external-tools.md` is finalized
- `dev/active/discovery/idea-brief.md` exists with archetype

## Inputs

Read these files to determine what the project needs:

| File | What to extract |
|------|----------------|
| `dev/active/discovery/idea-brief.md` | `## Archetype:` line → saas / internal / client |
| `docs/project/product-overview.md` | Pricing section → has billing? Business model → free/paid? |
| `docs/project/technical-requirements.md` | Auth providers, real-time needs, background jobs, security model |
| `docs/project/external-tools.md` | Full tool list with purpose and integration notes |
| `docs/project/users-and-journeys.md` | Onboarding flow → needs email? Notifications? |
| `docs/project/feature-map.md` | MVP features → cross-reference with tools needed |

## Known Tools Registry

Load `references/known-tools.json` from this skill directory. It contains pre-verified URLs, env var patterns, hints, and MCP commands for ~18 common tools.

**Matching rules:**
1. For each tool in `external-tools.md`, check if it exists in `known-tools.json` (match by key, case-insensitive)
2. If found → use the registry entry directly (URLs are verified, patterns are correct)
3. If NOT found → the tool-scout agent must have produced: signup URL, API key URL, env var name, and key format. Use that data to create a manifest entry. Set `"verified": false` on unverified entries.

## Manifest Schema

```jsonc
{
  "version": 1,
  "archetype": "saas | internal | client",
  "project_name": "My App",
  "generated_at": "ISO 8601",
  "generated_by": "discover",

  "phases": [
    {
      "id": "string",           // unique phase id: "pre_discover", "infrastructure", "services", "integrations", "monitoring"
      "label": "string",        // human label shown in wizard
      "description": "string",  // one-line description
      "order": 1,               // display order
      "steps": [
        {
          // Identity
          "id": "string",              // unique step id, matches known-tools.json key or tool slug
          "label": "string",           // display name
          "description": "string",     // why this tool is needed (from discover context)
          "category": "string",        // infrastructure | billing | email | monitoring | security | analytics | ai | integration | tooling | storage | maps | sms | media | background_jobs
          
          // Requirements
          "required": true,            // true = must complete, false = can skip
          "reason": "string",          // WHY this is needed — reference the discover doc that triggered it
          
          // Links (MUST have at least signup URL)
          "urls": {
            "signup": "https://...",   // REQUIRED: where to create account
            "api_keys": "https://...", // where to find/create API keys
            "docs": "https://..."      // documentation
          },
          
          // Environment variables to collect
          "env_vars": [
            {
              "key": "ENV_VAR_NAME",         // exact .env key
              "label": "Human Label",         // shown in the input field
              "placeholder": "sk_test_...",   // input placeholder
              "pattern": "^sk_(test|live)_",  // regex for client-side validation
              "hint": "Dashboard → Settings → API Keys", // where to find it
              "secret": true,                 // mask the input
              "optional": false,              // false = blocks step completion
              "default_value": null,          // pre-fill if set (e.g. Turnstile test key)
              "targets": [".env.local"],      // which files to write to (default: [".env.local"])
              "note": null                    // extra context shown below the input
            }
          ],

          // MCP server (if applicable)
          "mcp": {
            "name": "server-name",
            "command": "claude mcp add ..."
          },

          // CLI setup (if applicable — no env vars, just install + login)
          "cli": {
            "install": "npm i -g vercel",
            "login": "vercel login"
          },

          // Post-setup manual steps (if any)
          "post_setup_steps": [
            {
              "label": "Step label",
              "description": "What to do",
              "url": "https://...",
              "env_var": { /* same shape as env_vars[] entry */ }
            }
          ],

          // Verification
          "verification": {
            "type": "env_check",      // env_check (default) | http_ping | supabase_ping | stripe_ping | none
            "details": null            // type-specific config if needed
          },

          // Metadata
          "verified": true,           // false if URLs/patterns were discovered live (not from registry)
          "no_signup": false,         // true for tools that need no account (Context7)
          "default_optional": false   // true for tools that are always optional regardless of archetype
        }
      ]
    }
  ]
}
```

## Phase Organization

Organize steps into these phases, in this order:

### Phase 1: `pre_discover` — Claude Tooling
Tools Claude needs to work (already set up if discover ran, but verify):
- `context7` — always
- `jina` — always

**Note:** These are PRE-discover. If the manifest is being generated, discover already ran, so these should be auto-verified. Include them so the wizard can confirm they're set up.

### Phase 2: `infrastructure` — Platform Services  
Core platform — needed by almost every project:
- `github` — always
- `vercel` — always
- `supabase` — always (unless discover explicitly says no database/no auth)

### Phase 3: `services` — Business Services
Depends on archetype + discover output:
- `stripe` — if `product-overview.md` has pricing tiers / billing
- `resend` — if project sends emails (transactional, notifications, marketing)
- `inngest` — if `technical-requirements.md` lists background jobs

### Phase 4: `integrations` — Project-Specific Tools
From `external-tools.md` — every tool listed there gets a step:
- Known tools → pull from registry
- Unknown tools → use tool-scout's researched data

### Phase 5: `monitoring` — Optional Monitoring & Analytics
Always optional, but recommended:
- `sentry` — error tracking
- `posthog` — product analytics  
- `turnstile` — bot protection
- `tavily` — only if blog feature exists

## Decision Logic by Archetype

### SaaS (`--saas`)
- Stripe: **required** if pricing tiers exist in `product-overview.md`, skip if "free" / "open source"
- Resend: **required** (SaaS always sends emails: welcome, reset, notifications)
- Inngest: **required** if `technical-requirements.md` → Background Jobs section is non-empty
- Sentry: recommended (optional)
- Turnstile: recommended (optional)
- PostHog: recommended (optional)

### Internal Tool (`--internal`)
- Stripe: **skip** (internal tools don't bill)
- Resend: **skip** unless `users-and-journeys.md` mentions email notifications
- Inngest: include if background jobs listed
- Sentry: optional
- Turnstile: **skip** (internal, no public forms)
- PostHog: optional

### Client Project (`--client`)
- Stripe: include only if the client's product charges THEIR users
- Resend: include if transactional emails needed
- Inngest: include if background jobs listed
- Sentry: recommended
- Turnstile: include if public-facing forms
- PostHog: optional

## Tool-Scout Requirements for Unknown Tools

When tool-scout finds a tool NOT in `known-tools.json`, it MUST produce:

1. **`signup_url`** — Verified. Agent must `read_url` the signup page and confirm it loads.
2. **`api_keys_url`** — The specific page where API keys are created/found. Not just the dashboard root.
3. **`env_var_name`** — Following conventions: `NEXT_PUBLIC_` prefix for client-safe keys, `UPPERCASE_SNAKE_CASE`.
4. **`env_var_pattern`** — Regex to validate the key format. If unknown, use `"."` (accept anything).
5. **`env_var_hint`** — Human-readable directions: "Go to Settings → API → Copy the key".
6. **`docs_url`** — Link to documentation.

**If the agent cannot verify a URL** (Jina returns error, page doesn't exist), it must:
- Set `"verified": false` on the step
- Add a `"note"` explaining the URL couldn't be verified
- Still include the best-guess URL — the user can correct it

## Multi-Target Env Vars

Some env vars need to go to multiple files:

```jsonc
{
  "key": "RESEND_API_KEY",
  "targets": [".env.local", "supabase/functions/.env"]
}
```

Default target is `[".env.local"]` if not specified. The dashboard writes to ALL targets when the user saves.

## Idempotency

The manifest can be regenerated safely:
- Re-running `/discover` overwrites `setup-manifest.json`
- Progress is tracked separately in `dev/setup-progress.json` (dashboard-owned)
- The dashboard merges: manifest for structure, progress for status
- If a step exists in progress but not in the new manifest → ignored
- If a step exists in the manifest but not in progress → shown as pending

## Example: Minimal Internal Tool

```json
{
  "version": 1,
  "archetype": "internal",
  "project_name": "Team Dashboard",
  "generated_at": "2026-04-03T10:00:00Z",
  "generated_by": "discover",
  "phases": [
    {
      "id": "pre_discover",
      "label": "Claude Tooling",
      "description": "Tools for Claude Code to work effectively",
      "order": 1,
      "steps": [
        {
          "id": "context7",
          "label": "Context7",
          "description": "Live library documentation for Claude",
          "category": "tooling",
          "required": true,
          "reason": "Claude needs up-to-date library docs",
          "urls": {},
          "env_vars": [],
          "mcp": { "name": "context7", "command": "claude mcp add context7 -- npx -y @upstash/context7-mcp" },
          "no_signup": true,
          "verified": true
        }
      ]
    },
    {
      "id": "infrastructure",
      "label": "Infrastructure",
      "description": "Core platform services",
      "order": 2,
      "steps": [
        {
          "id": "github",
          "label": "GitHub",
          "description": "Version control and CI/CD",
          "category": "infrastructure",
          "required": true,
          "reason": "All projects need version control",
          "urls": { "signup": "https://github.com/signup" },
          "env_vars": [],
          "cli": { "install": "npm i -g gh", "login": "gh auth login" },
          "verified": true
        },
        {
          "id": "supabase",
          "label": "Supabase",
          "description": "Database and SSO authentication",
          "category": "infrastructure",
          "required": true,
          "reason": "technical-requirements.md: PostgreSQL + SSO auth required",
          "urls": {
            "signup": "https://supabase.com/dashboard/sign-up",
            "api_keys": "https://supabase.com/dashboard/project/_/settings/api"
          },
          "env_vars": [
            { "key": "NEXT_PUBLIC_SUPABASE_URL", "label": "Project URL", "placeholder": "https://xxxxx.supabase.co", "pattern": "^https://[a-z]+\\.supabase\\.co$", "hint": "Settings → API → Project URL", "secret": false },
            { "key": "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "label": "Anon Key", "placeholder": "eyJ...", "pattern": "^eyJ", "hint": "Settings → API → anon public", "secret": false }
          ],
          "mcp": { "name": "supabase", "command": "claude mcp add --transport http supabase https://mcp.supabase.com/mcp" },
          "verified": true
        }
      ]
    }
  ]
}
```

Note: no Stripe, no Resend, no Turnstile — because it's an internal tool. Only what's needed.
