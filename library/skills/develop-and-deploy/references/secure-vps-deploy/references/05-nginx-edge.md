# Nginx Edge

Use this only if the VPS path needs a public reverse proxy.

## Good Uses

- TLS termination
- forwarding traffic to an app on another port
- domain-based routing
- basic headers and compression

## Avoid

- adding Nginx when the app can be served directly behind another edge
- mixing edge setup with app rollout before the upstream is actually healthy

## Starter Template

Use:

```bash
library/skills/develop-and-deploy/references/secure-vps-deploy/scripts/render-nginx-site.sh example.com 127.0.0.1 3000
```

Then adapt the output to the target host.

## Verification

- `nginx -t`
- reload only after config test passes
- verify the upstream app is reachable before blaming the edge

## When To Break Out

Use the imported `nginx-configuration` skill if the work becomes Nginx-heavy.
