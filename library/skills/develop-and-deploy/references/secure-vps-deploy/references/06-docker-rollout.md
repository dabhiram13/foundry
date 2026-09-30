# Docker Rollout

Use this only when the VPS path is containerized.

## Focus

- image build boundary
- env injection
- port exposure
- health checks
- restart behavior

## Preferred Order

1. verify Docker is present on the target or build host
2. prepare env files or secret injection path
3. build or pull the image
4. start the container or compose stack
5. verify health before exposing with Nginx

## Rules

- keep containers non-root when practical
- prefer explicit health checks
- avoid exposing ports publicly if Nginx will front the app

## When To Break Out

Use the imported `docker-deployment` skill if the request becomes purely Docker-focused.
