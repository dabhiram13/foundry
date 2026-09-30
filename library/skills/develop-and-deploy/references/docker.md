# Docker

Use when the app needs containerized deployment, custom runtime packaging, or a provider outside the default platform path.

## Best Fit

- services that do not fit Vercel cleanly
- worker/API combinations
- self-hosted deployments
- parity between local and production environments

## Underlying Skills

- `docker-deployment`
- `ssh` if the container host is remote
- `nginx-configuration` if a reverse proxy is involved

## Focus

- image boundaries
- environment variables
- ports
- health checks
- production-safe defaults

## Avoid

- adding Docker when the project only needs a normal Vercel deploy
