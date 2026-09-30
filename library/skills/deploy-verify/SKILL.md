---
name: deploy-verify
description: >
  Source-agnostic post-deploy verification. Use for "verify this deploy", "deploy check",
  "post-deploy smoke test", "is production healthy", "verify the rollout", "visual regression",
  "screenshot test", after any push to Vercel / Docker / VPS. Runs health / SSL / env / perf /
  content / API checks plus browser interaction, responsive-layout and accessibility passes on the
  touched routes, compares staging vs prod, proves the rollback path exists, and emits a
  PASS / FAIL / INCOMPLETE verdict with evidence. Feeds failures to `/heal`.
---

# Deploy Verify

Runs **after** a deploy, not before. Proves the rollout actually works. Delegates to `canary-watch` for live monitoring; adds env / SSL / DNS / feature-flag / rollback-readiness checks around it.

## When to Use

- Immediately after `vercel deploy`, `docker compose up`, or VPS rollout
- After merging a risky PR to a branch that auto-deploys
- After dependency upgrades that change build output or runtime
- Before declaring a release "done"
- When triaging a suspected live regression (Sentry spike, user report) — prove the deploy is or isn't the cause

## Core Rules

1. **Verifier is a separate lane.** The same agent that deployed does not self-approve. Run this skill as an independent reviewer pass.
2. **Evidence only.** Every dimension gets a command or probe whose output is captured. "Looks fine" is not evidence.
3. **Verify the deploy that actually shipped.** Pin the commit SHA / build ID / image digest before checking. A regression between check and verify invalidates the pass.
4. **Rollback posture is a precondition.** If you cannot state how to revert in under 60 seconds, the deploy is not verifiable — fix that first.
5. **Fail closed.** Any critical dimension red → verdict FAIL. Partial coverage → INCOMPLETE, not PASS.
6. **Route to the platform.** Call platform-specific skills for platform-specific checks; this skill composes, it does not reimplement.

## Verification Dimensions

Borrowed from `canary-watch` (HTTP / console / network / perf / content / API) and extended with deploy-specific layers:

| Dimension | What | Tool | Threshold |
|---|---|---|---|
| **HTTP** | Homepage + critical routes return 200 | `canary-watch`, `curl -I` | 200 only; redirects must terminate on 200 |
| **SSL / TLS** | Cert valid, ≥ 30 days until expiry, chain complete | `openssl s_client -connect host:443`, `curl --cert-status` | Expired or < 30d warning = FAIL |
| **DNS** | Apex + `www` resolve, point where expected, propagated | `dig +short`, `dig @1.1.1.1` | Mismatched A/CNAME = FAIL |
| **Redirects** | HTTP → HTTPS, `www` ↔ apex policy honored, no loop | `curl -I -L` | Redirect loop = FAIL |
| **Env vars** | Required keys present on the platform, non-empty, no dev values in prod | `vercel env ls`, `ssh host "printenv"`, `fly secrets list` | Missing required key = FAIL |
| **Console errors** | No new errors vs baseline | `canary-watch` | Any new severity=error = FAIL |
| **Network** | No 4xx/5xx on API calls during load | `canary-watch`, browser devtools | 5xx on any critical path = FAIL |
| **Performance** | LCP / CLS / INP not worse than baseline | `canary-watch`, Lighthouse | LCP +500ms or CLS +0.05 = WARN |
| **Content sentinels** | `h1`, nav, footer, CTA present | `canary-watch` | Any missing = FAIL |
| **API SLA** | Critical endpoints respond within p95 budget | `canary-watch`, ad-hoc `curl -w` | p95 > budget = WARN |
| **Feature flags** | Flags expected ON are ON for the target audience | platform dashboard / API | Mismatch = FAIL |
| **Sentry / errors** | No spike in error rate in the minutes after deploy | Sentry dashboard / API | >2× baseline rate = FAIL |
| **DB migrations** | All migrations applied; no drift | `supabase db diff`, migration tool output | Drift = FAIL |
| **Interaction flows** | Nav links resolve, forms accept valid input and surface an error state on invalid input, auth round-trip (login → protected route → logout) | `agent-browser` | Dead link, missing error state, or broken auth round-trip = FAIL |
| **Responsive layout** | Touched pages at 375 / 768 / 1440 px: no overflow, no dropped element, dark mode consistent | `agent-browser` screenshots vs the last verified set | Overflow or dropped element = FAIL; shift > 5px vs baseline = WARN |
| **Accessibility** | axe-core (or equivalent) on the touched routes, keyboard path end-to-end, landmarks present | `browser-debugging` (see its `references/a11y-debugging/`) | Any WCAG AA violation = FAIL |

Use the **git-diff inferred verification plan** pattern (from jonmumm's deploy-verify): `git diff <last-verified-sha>..HEAD` → identify changed surfaces → add targeted checks for each (touched route, touched API, touched env var, touched migration). Don't verify what didn't change.

## Execution Protocol

### Phase 1 — Prepare

```markdown
## Verify Context
- Target: (production | staging | preview URL)
- Platform: (Vercel | Docker | VPS | ...)
- Deployed SHA / build ID / image digest:
- Previous known-good SHA / build ID:
- Rollback command (must be < 60s):
- Changed surfaces (from git diff):
- Dimensions applicable:
```

If `Rollback command` is unknown, stop. Go fix the runbook first.

### Phase 2 — Execute

Run the applicable dimensions. Prefer parallel probes when independent. Capture the exact command and raw output for each.

**Evidence Table** (fill one row per dimension run):

| Dimension | Probe | Result | Evidence |
|---|---|---|---|
| HTTP / | `curl -I https://app.com/` | 200 OK | `HTTP/2 200\nserver: vercel\n…` |
| SSL | `openssl s_client -connect app.com:443 -servername app.com < /dev/null 2>/dev/null \| openssl x509 -noout -dates` | 87 days left | `notAfter=Jul 12 00:00:00 2026 GMT` |
| Console | `canary-watch https://app.com --once` | 0 new errors | `.foundry/local/canary-watch.log` |
| …| | | |

### Phase 3 — Gap analyze

For each dimension: was it actually *run*, with *fresh* evidence (within this verify pass, not cached)? Anything skipped or inherited marks the dimension INCOMPLETE.

### Phase 4 — Verdict

Emit one of:

- **PASS** — all applicable dimensions green, evidence fresh, rollback path proven.
- **FAIL** — at least one critical dimension red. Include the failing probe output and the rollback recommendation.
- **INCOMPLETE** — coverage gap; list the dimensions not run and why.

Never PASS on partial evidence. "I couldn't test it" ≠ "it's fine."

## Platform Routing

Call these skills for platform-specific mechanics — `deploy-verify` owns the *method*, they own the *surface*:

| Platform | Skill | Use for |
|---|---|---|
| Vercel | `develop-and-deploy` (see `references/vercel-cli/`), `vercel-react-best-practices` | `vercel ls`, env inspection, deployment metadata |
| VPS | `develop-and-deploy` (see `references/secure-vps-deploy/references/07-verification-and-rollback.md`) | Process/container status, Nginx config reload, upstream reachability |
| Docker | `develop-and-deploy` (see `references/docker-deployment/`) | Compose health, container logs, image digest pinning |
| Supabase | `supabase` | Migration state, RLS drift, edge-function version |
| Sentry | `sentry`, `sentry-cli` | Post-deploy error-rate spike check |
| Performance | `browser-debugging` (see `references/chrome-devtools/` and `references/debug-optimize-lcp/`), `canary-watch` | LCP / CLS / INP vs baseline |
| Accessibility | `browser-debugging` (see `references/a11y-debugging/`) | Post-deploy a11y regression |
| Payments | `payments-verification` | Checkout / webhook / portal after a billing-touching deploy |

## Rollback Posture

Before the deploy is considered verified, state three things in writing:

1. **Previous known-good artifact** — SHA, build ID, or image digest.
2. **Rollback command** — the *exact* one-liner or UI click path. e.g. `vercel promote <url> --prod`, `git revert <sha> && git push`, `docker compose up -d --no-deps app:prev`.
3. **Last-known-good state** — DB migration pointer, feature flag state, cache warmth. Anything that would have to be re-established.

If a verify fails in a way the rollback can address, recommend rollback as the first action. If the failure is orthogonal (e.g. DNS misconfig), rolling back won't help — say so.

## Output Format

```markdown
## Deploy Verify Report

**Target:** <url>
**Platform:** <vercel | docker | vps>
**Deploy ID:** <sha/build-id/digest>
**Previous known-good:** <sha/build-id/digest>
**Verdict:** PASS | FAIL | INCOMPLETE

### Changed Surfaces
- <path / route / procedure / migration touched in this deploy>

### Evidence Table
| Dimension | Probe | Result | Evidence |
|---|---|---|---|
| ... | ... | ... | ... |

### Acceptance Criteria
| Criterion | Status | Evidence |
|---|---|---|
| Homepage returns 200 | VERIFIED | curl output captured |
| SSL valid ≥ 30 days | VERIFIED | openssl output captured |
| No console error regression | VERIFIED | canary-watch log path |
| No Sentry spike | PARTIAL | baseline window too short |
| DB migrations applied | MISSING | not run |

### Rollback
- Command: `<exact one-liner>`
- Verified last-known-good: <sha>
- Expected downtime: <seconds>

### Next Action
- PASS → close the task, note the SHA as the new baseline.
- FAIL → run rollback OR fix forward; specific recommendation here.
- INCOMPLETE → list the dimensions still to verify.
```

Save to `dev/reports/deploys/<sha>-<timestamp>.md` so `/heal` and `trace-to-skill` can consume it.

## Failure Modes to Avoid

- **Self-approval** — the agent that deployed shouldn't write the verdict. Run this skill as a clean pass.
- **Cached evidence** — reusing a probe result from earlier in the session. Every verify run is fresh.
- **Verifying what didn't change** — burning time on stable surfaces while ignoring touched ones. Use the git diff.
- **Soft PASS** — calling a deploy green when one dimension was "probably fine." If you didn't probe it, it's INCOMPLETE.
- **Missing rollback** — shipping "verified" without a 60-second revert path. Rollback is a precondition, not a bonus.
- **Baseline drift** — comparing perf / errors to a baseline that's older than the last successful deploy. Refresh the baseline per release.
- **Over-verification** — running a 20-minute full matrix on a docs-only change. Scale checks to the blast radius of the diff.

## Final Checklist

- Did I pin the exact deploy ID before probing?
- Did I know the rollback command before starting?
- Did I run all dimensions touched by the diff?
- Is every dimension backed by captured probe output?
- Did I check SSL / DNS / env vars, not just HTTP 200?
- Did I drive the touched routes in a browser at 375 / 768 / 1440 px, not just curl them?
- Did I refresh the Sentry / perf baselines?
- Did I emit a PASS / FAIL / INCOMPLETE verdict (no "looks good")?
- Did I save the report to `dev/reports/deploys/`?
