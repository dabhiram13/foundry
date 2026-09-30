<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: deploy
description: Ship the app to Vercel end-to-end — readiness audit, missing-credential handoff, deploy, post-deploy verification. Vercel only; Docker and VPS are not part of this kit.
---

# Deploy

Use this when the user wants to ship, deploy, or move to production.

Load `develop-and-deploy` first.

Do not skip verification after deployment.
Do not ask for every secret upfront.

Arguments: `$ARGUMENTS`
- no args = inspect the project and deploy to Vercel
- `--plan-only` = write the plan but do not execute

---

## Why Vercel-only

This kit ships opinionated content for **Vercel only**. The `develop-and-deploy` and `deploy-verify` skills cover that path end-to-end. Docker and VPS are not shipped: the skills that would carry them (`docker-deployment`, `secure-vps-deploy`, `nginx-configuration`) are not in the kit, and a `--docker` or `--vps` flag pointing at skills that do not exist would silently degrade to "Claude improvises".

If the user explicitly asks for Docker or VPS today, be honest:

> Docker / VPS deploy is not part of this kit — the matching skills are not shipped, so I won't pretend to deploy you with them. I can deploy you to Vercel end-to-end. Would you like that, or do you want me to stop here?

---

## Purpose

`/deploy` owns:
- Vercel deploy readiness audit
- setup handoff for missing credentials
- Vercel-path execution
- post-deploy verification

`/deploy` does not own:
- full product discovery
- feature scoping
- unrelated build work

---

## Output Files

Always create `dev/active/deploy/` if it does not exist.

Always write:
- `dev/active/deploy/plan.md`
- `dev/active/deploy/status.md`

If execution happens, also write:
- `dev/active/deploy/verdict.md`

---

## Step 1: Read The Current Project

Read only what matters:
1. `package.json` if it exists
2. `webapp/package.json` if it exists
3. `README.md`
4. `docs/project/technical-requirements.md` if it exists
5. `docs/project/external-tools.md` if it exists
6. `webapp/.env.example` if it exists
7. `vercel.json` if it exists

Confirm signals for Vercel:
- Next.js / Vercel-ready app
- no hard dependency on a long-running worker
- no explicit self-hosting requirement

If the app clearly is not Vercel-compatible (e.g. Dockerfile-driven multi-service, explicit self-host), stop and tell the user v0.2 is needed.

---

## Step 2: Activate The Vercel Path

Activate:
- `develop-and-deploy`
- `deploy-verify`

Do not pretend to activate skills that do not exist in `library/skills/`. If a skill referenced by documentation is absent, name that fact and stop.

---

## Step 3: Build The Deploy Plan

Write `dev/active/deploy/plan.md` in this shape:

```markdown
# Deploy Plan

## Request
- what the user wants:

## Chosen Path
- target: Vercel
- why:
- activated skills: develop-and-deploy, deploy-verify

## Readiness
- app type:
- deploy signals found:
- missing prerequisites:

## Setup Needed Later
- credentials:
- env vars:

## Execution Plan
1.
2.
3.

## Verification
- what success looks like:
- how it will be checked:
```

Write `dev/active/deploy/status.md`:

```markdown
# Deploy Status

- state: planning
- chosen_path: vercel
- blockers:
- next_step:
```

---

## Step 4: Present The Plan

Respond in this shape:

> Deploy path: Vercel
> - why: {short reason}
> - skills activated: develop-and-deploy, deploy-verify
> - missing setup items: {tokens, env vars, domains}
> - first safe next step: {one action}
>
> Proceed? Yes or no.

If `--plan-only` is set, stop after writing the plan.

---

## Step 5: Setup Handoff

If credentials or access are missing, do not ask for everything at once.

Route to `/setup vercel` with only the missing surfaces. Let `/setup` own the signup-link + command-to-run pattern.

Update `dev/active/deploy/status.md`:

```markdown
- state: waiting-on-setup
- blockers:
- next_step: /setup vercel
```

---

## Step 6: Execute The Vercel Path

Do this in order:
1. verify `vercel` CLI is available; if not, tell the user the exact command to run in a new terminal and wait
2. verify project link state
3. verify required env vars are present
4. run the build gate first if appropriate
5. deploy preview or production depending on the request
6. capture the deployment URL

Default:
- preview first unless the user explicitly asked for production

---

## Step 7: Post-Deploy Verification

Always verify:
- deployment completed
- app loads
- one critical flow works
- main environment is correctly wired

Write `dev/active/deploy/verdict.md`:

```markdown
# Deploy Verdict

- target: vercel
- result: success | partial | failed
- deployment_url:
- verified_flow:
- remaining blockers:
- next_action:
```

Update `dev/active/deploy/status.md`:

```markdown
- state: deployed
- blockers: none
- next_step: monitor or continue building
```

If it fails, set:

```markdown
- state: failed
- blockers:
- next_step:
```

---

## Success Criteria

Deploy is successful when:
- Vercel is the chosen path
- only skills that actually exist are activated
- secrets are collected later through `/setup`, not dumped upfront
- execution follows a narrow, safe path
- the deployed result is verified, not assumed
- the user is told honestly that Docker/VPS are v0.2 material
