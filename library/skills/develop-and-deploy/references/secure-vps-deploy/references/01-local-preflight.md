# Local Preflight

Before touching the server, verify the local machine can drive the rollout.

## Check Locally

Run:

```bash
library/skills/develop-and-deploy/references/secure-vps-deploy/scripts/vps-preflight.sh
```

You want:
- `ssh`
- `scp`
- `ssh-copy-id`
- `rsync`

If the deploy path is containerized, also verify Docker where the image will be built.

## Gather Only What Is Needed

Do not ask for everything upfront.
For the VPS path, collect only:

- SSH host or alias
- SSH username
- authentication method
- domain name, if a public edge is needed
- whether the app is raw process or Docker-based

Anything missing should be routed through `/setup`.

## Success

You know:
- how you will connect
- how you will copy or deploy artifacts
- whether Docker is involved
- whether a public domain / reverse proxy is required
