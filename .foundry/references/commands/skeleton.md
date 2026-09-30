<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: skeleton
description: Clone an opinionated starter skeleton into the current project. Use when the user wants to build on the buildthisnow reference stack instead of scaffolding from scratch.
---

# Skeleton

One command to lay down an opinionated starter. You stay in Claude, the skeleton lands around you, and you keep moving.

Arguments: `$ARGUMENTS`
- `saas` — Next.js 16 + Supabase + Stripe + Tailwind v4 SaaS starter
- *(roadmap)* `api-only`

If no argument is given, ask which variant — then proceed.

---

## What this does

1. Verifies the current working directory is a project root (has `.git` or `package.json`, or is empty).
2. If `webapp/` or `supabase/` already exists, **asks the user** whether to rename-to-`.bak`, overwrite, or abort. Never hard-exits without a choice.
3. Clones the skeleton repo at the pinned commit SHA (not `main`) into a temp dir.
4. Rsyncs skeleton contents into the project root (excluding `.git/`). Narrates each top-level path with a one-line plain-English tag.
5. Runs `npm install` inside `webapp/` in the background while you keep chatting.
6. Updates `.foundry/state/project.json` with `skeleton: "<name>"` + `installed_at` + `skeleton_sha`.
7. Reports back with the next two commands: `/setup supabase` and `/setup stripe`.

## Available skeletons

| Name | Repo | SHA pin | What's wired |
|------|------|---------|--------------|
| `saas` | https://github.com/ZeiProX76/buildthisnow-saas-skeleton | `<maintained in lib/constants.js SKELETONS.saas.commit>` | Auth (email+OTP + Google OAuth), billing (Stripe checkout + webhook), onboarding, rate-limiting, JWT custom claims, Sentry hooks, Playwright E2E, OKLCH design tokens, dark mode |

**Why SHA-pinned:** a regression on `main` would break every new install. Advance the SHA when the skeleton repo has been smoke-tested against the current buildthisnow version.

## Exact steps

```bash
# 1. Load the pinned SHA from lib/constants.js SKELETONS.<name>.commit
#    (Claude: read that value before running the bash below.)
SKELETON_NAME="<arg>"
SKELETON_REPO="<from constants>"
SKELETON_SHA="<from constants>"

# 2. Interactive guard on collisions
for dir in webapp supabase; do
  if [ -d "$dir" ]; then
    # Claude: ASK the user here. Do not hard-exit.
    # Offer three choices:
    #   r = rename existing to <dir>.bak.<timestamp>
    #   o = overwrite in place (explain: files will be replaced, extras kept)
    #   a = abort
    # Act on the user's choice before continuing.
    :
  fi
done

# 3. Clone into tmp at the pinned SHA
TMP=$(mktemp -d)
git clone --depth=1 "$SKELETON_REPO" "$TMP/sk"
(cd "$TMP/sk" && git fetch --depth=1 origin "$SKELETON_SHA" && git checkout "$SKELETON_SHA")

# 4. Copy with narration — Claude prints each top-level path with a plain-English tag
#    Tags come from the skeleton's .buildthisnow-manifest.json if present,
#    otherwise a sensible default is synthesized.
rsync -a --exclude='.git/' "$TMP/sk/" ./

# 5. Non-blocking install
(cd webapp && npm install > /tmp/skeleton-install.log 2>&1 &)

# 6. Mark state
mkdir -p .foundry/state
node -e "const fs=require('fs'),p='.foundry/state/project.json';const s=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):{};s.skeleton='$SKELETON_NAME';s.skeleton_sha='$SKELETON_SHA';s.skeleton_installed_at=new Date().toISOString();fs.writeFileSync(p,JSON.stringify(s,null,2)+'\n');"

rm -rf "$TMP"
```

## Narration format

While rsync runs, Claude prints one line per top-level path with a plain-English tag. This is the delight moment — the user watches their SaaS materialize.

Example output:
```
✓ webapp/app/(auth)/login/page.tsx        ← your login page, already wired
✓ webapp/app/api/stripe/webhook/route.ts  ← Stripe events land here
✓ supabase/migrations/001_auth.sql        ← RLS policies, already safe
→ running npm install (backgrounded)...
```

If the skeleton repo contains `.buildthisnow-manifest.json` at its root, use its `tags` mapping. Otherwise, synthesize a six-word tag from the path.

## Collision prompt (exact copy)

```
webapp/ already exists here.

  [r] rename to webapp.bak.<timestamp> and clone fresh
  [o] overwrite in place (existing unique files stay, shared files replaced)
  [a] abort

Choice?
```

Wait for the user to answer. Never assume.

## After skeleton lands

Tell the user, in this order, with no more than two lines per bullet:

1. **Supabase next.** Run `/setup supabase` — creates the project, applies `.foundry/migrations/01`-`05`, enables the Custom Access Token hook, and writes env vars. Two Supabase toggles have no CLI (Stripe Sync Engine, Custom Access Token hook); `/setup` walks you through both. No other dashboard clicks unless genuinely required.
2. **Stripe next.** Run `/setup stripe` — CLI-first: products, prices, webhook endpoint, env vars.
3. **Env.** `webapp/.env.example` is pre-filled with variable names; `/setup` steps write the actual values.

Do not overload the user with all of this at once. They just cloned a skeleton — respect the moment.

## When NOT to use this

- If the user is adding capability to an existing app → use `/setup <service>` or targeted commands (`/logo`, `/landing-design`, `/emails`, etc.).
- If the user explicitly said "no skeleton" or "from scratch" → do not run this.

## Failure recovery

If the clone fails (network, rate limit, private repo access):
- Report the exact error.
- Offer manual path: `git clone https://github.com/ZeiProX76/buildthisnow-saas-skeleton.git /tmp/sk && (cd /tmp/sk && git checkout <SHA>) && rsync -a --exclude='.git/' /tmp/sk/ ./`
- Do not retry automatically — most failures are cases the user needs to resolve (auth, network).
