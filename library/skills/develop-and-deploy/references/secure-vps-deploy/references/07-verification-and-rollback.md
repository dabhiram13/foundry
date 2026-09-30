# Verification And Rollback

No VPS deploy is complete without a verification pass and a rollback stance.

## Verify

After rollout, confirm:

- the process or container is running
- the app responds on the expected internal port
- the public URL loads
- one critical app flow works
- logs are clean enough to proceed

## Minimal Checks

- process or container status
- upstream reachability
- Nginx config test if used
- public HTTP response
- one application flow

## Rollback Posture

Before a risky change, know:

- what was running before
- how to switch back
- which config or image version was last known-good

If rollback is unclear, the deploy plan is incomplete.
