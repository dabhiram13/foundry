# Firewall Policy

The firewall should reflect the actual deployment shape, not a generic checklist.

## Default Posture

- deny incoming
- allow outgoing
- explicitly allow SSH before enabling

## Open Only What Is Needed

- `22/tcp` or the chosen SSH port
- `80/tcp` and `443/tcp` only if the app is internet-facing
- no direct database port exposure unless there is a very specific reason

## Rules

- Do not enable UFW before the SSH rule exists.
- Prefer application-specific rules over broad exposure.
- If Tailscale or a private mesh is used, narrow the public edge further.

## Verification

Always check:

```bash
sudo ufw status verbose
```

## When To Break Out

Use the imported `firewall-configuration` skill if the request becomes purely firewall-specific.
