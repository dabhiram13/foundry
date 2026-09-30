# Post-Purchase Verdict

A payment verification verdict should say:

- provider
- flow tested
- passed checks
- failed checks
- user-visible result
- system-visible result
- next action

Keep it short and concrete.
If it failed, name the narrowest likely layer:
- checkout UI
- redirect logic
- webhook/sync
- entitlement update
- billing settings / portal
