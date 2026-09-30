# Server Hardening

Once SSH bootstrap is verified, harden the host.

## Baseline

- update packages
- enable unattended upgrades
- disable root SSH login
- disable password SSH auth
- verify `sshd -t` before restart

## Rules

- Sequence matters more than completeness.
- Verification after each hardening change is mandatory.
- Do not layer in advanced defense before the basic posture is stable.

## Recommended Order

1. OS updates
2. unattended upgrades
3. non-root sudo user
4. SSH hardening
5. optional private access layer such as Tailscale

## When To Break Out

Use the imported `secure-vps-setup` or `ssh-hardening` skills if the work narrows into one of those subdomains.
