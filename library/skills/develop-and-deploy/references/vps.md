# VPS

Use when the team explicitly wants SSH-managed infrastructure and accepts the added ops burden.

## Best Fit

- self-hosted products
- custom infra control
- direct SSH workflows
- Nginx / SSL / firewall hardening

## Underlying Skills

- `secure-vps-deploy` as the first-party VPS path
- imported fallbacks only when the work narrows into SSH, firewall, Nginx, or Docker specifics

## Required Discipline

- explicit server setup plan
- SSH access handled in `/setup`
- environment and secret handling separated from code work
- clear rollback plan

## Warning

Do not route casual deploy requests to VPS by default.
VPS is the high-control path, not the default path.
