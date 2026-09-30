---
name: secure-vps-deploy
description: >
  Opinionated secure VPS deployment workflow for Linux servers. Use for "vps deploy",
  "self-host", "ssh deploy", "secure server", "nginx", "firewall", "tailscale", or
  "deploy to a VPS". This skill routes SSH bootstrap, hardening, firewall policy,
  reverse proxy setup, container rollout, and verification in one linear path.
---

# Secure VPS Deploy

This is the kit's first-party VPS deployment skill.

Use it when the chosen deployment path is VPS.
Do not use it for normal Vercel deployments.

## What This Skill Does

It compresses the VPS path into one opinionated workflow:

1. local preflight
2. SSH bootstrap
3. server hardening
4. firewall policy
5. edge proxy setup
6. app rollout
7. verification and rollback

This skill is the index.
Detailed guidance lives in `references/`.
Utility helpers live in `scripts/`.

## When to Use

- The user explicitly wants a VPS.
- The product must be self-hosted.
- SSH, Nginx, firewall, or direct server control is required.
- Docker is part of a VPS rollout.

## Core Rules

1. SSH access and rollback come before hardening.
2. Never close the only working connection before the next one is verified.
3. Open only the ports the deployed system actually needs.
4. Reverse proxy setup is explicit; do not assume Nginx is required if it is not.
5. Credentials and access are still collected through `/setup`, one surface at a time.
6. Verification is mandatory after every major phase.

## Standard Workflow

1. Run `scripts/vps-preflight.sh`
2. Read `references/01-local-preflight.md`
3. Read `references/02-ssh-bootstrap.md`
4. Read `references/03-server-hardening.md`
5. Read `references/04-firewall-policy.md`
6. If a reverse proxy is needed, use `references/05-nginx-edge.md`
7. If the app is containerized, use `references/06-docker-rollout.md`
8. Finish with `references/07-verification-and-rollback.md`

## Scripts

- `scripts/vps-preflight.sh` — checks local tooling before a VPS rollout
- `scripts/render-nginx-site.sh` — prints a starter Nginx site config from a domain and upstream

## References

- `references/01-local-preflight.md`
- `references/02-ssh-bootstrap.md`
- `references/03-server-hardening.md`
- `references/04-firewall-policy.md`
- `references/05-nginx-edge.md`
- `references/06-docker-rollout.md`
- `references/07-verification-and-rollback.md`

## Source Notes

This first-party skill is distilled from the imported `ssh`, `secure-vps-setup`,
`ssh-hardening`, `firewall-configuration`, `nginx-configuration`, and
`docker-deployment` skills. Use those as deeper fallbacks only when the narrower
implementation details are needed.
