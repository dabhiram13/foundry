---
name: develop-and-deploy
description: >
  Route deployment and infrastructure work across Vercel, Docker, and VPS paths. Use for "deploy",
  "deployment", "vercel deploy", "docker", "vps", "ssh", "nginx", "ssl", or "firewall". Good for
  deciding how to ship, what infra is needed, and which credentials should be collected later in
  setup.
---

# Develop And Deploy

This skill picks the right deployment path before implementation drifts into infra work.

## Installed Building Blocks

This skill is the router; the depth lives under `references/` and is loaded on demand:

- `references/secure-vps-deploy/` — the kit's first-party VPS path
- `references/vercel-cli/` — the Vercel path (`references/vercel-cli/references/vercel-cli-with-tokens/` for CI tokens)

## When to Use

- The user wants to deploy or ship the project.
- The user needs Docker, Vercel, VPS, Nginx, SSL, firewall, or SSH guidance.
- The user wants the product to be production-ready.

## Core Rules

1. Choose the simplest path that matches the product.
2. Default to platform deploys before custom infra.
3. Ask for infra credentials later in `/setup`, one surface at a time.
4. Separate build concerns from deploy concerns.
5. Production hardening is explicit, not implied.

## Decision Tree

- **Next.js / simple web app / lowest ops burden** → `references/vercel.md`
- **Custom runtime or containerized app** → `references/docker.md`
- **Full VPS ownership / SSH / Nginx / firewall / server hardening** → `references/vps.md`

If the user just wants to ship fast, prefer Vercel first.

## Standard Workflow

1. Identify what is being deployed:
   - web app
   - API
   - worker
   - full-stack app
2. Identify constraints:
   - custom runtime
   - region / data control
   - self-hosting requirement
   - budget sensitivity
3. Choose the path.
4. List:
   - deployment target
   - credentials needed later
   - environment variables needed later
   - first safe deployment step
   - underlying skills to activate

## Output Shape

Always produce:

- chosen deployment path
- why it fits
- underlying skills to activate
- blocking credentials or env vars
- setup items to defer to `/setup`
- next command

## References

Path-picking stubs (start here):
- `references/vercel.md`
- `references/docker.md`
- `references/vps.md`

Folded-in depth skills (load on demand):
- `references/secure-vps-deploy/` — SSH bootstrap, hardening, firewall, reverse proxy, rollout, verify
- `references/docker-deployment/` — multi-stage builds, Compose, prod optimization
- `references/vercel-cli/` — deploy, env, domains, logs from CLI
- `references/deployment-patterns/` — CI/CD, health checks, rollback, readiness
