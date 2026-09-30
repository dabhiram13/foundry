<!-- Licensed source recipe retained as reference data; do not execute it directly. -->

---
name: monitor
description: Set up scheduled tasks for recurring security, performance, audit, and sentry checks. Cross-platform (Linux/macOS/Windows). Persists across sessions.
---

# Monitor Setup

Configure recurring automated checks via OS-native scheduled tasks. These persist across sessions and run even when Claude Code is not open.

Arguments: `$ARGUMENTS`
- No args = interactive setup (asks about cycle lengths)
- `--defaults` = use default intervals without asking
- `--stop` = remove all monitor tasks
- `--status` = show current scheduled tasks and last run results
- `--test <check>` = run a single check now through the runner script (tests retry, status tracking, logging)

---

## CRITICAL: Use System Cron, NOT CronCreate

**NEVER use the `CronCreate` tool for /monitor.** CronCreate is session-only and dies when Claude exits.
/monitor MUST use **system crontab** (Linux/macOS) or **Task Scheduler** (Windows) via the **Bash tool**.
This is the entire point of /monitor — persistent scheduled tasks that survive session restarts.

## Runner Script

All cron entries call `.foundry/scripts/claude-monitor-run.sh` instead of `claude -p` directly.
The runner provides:
- **Transient error retry** — 3 attempts with exponential backoff (30s, 1m, 5m) for rate limits, timeouts, network errors
- **Structured status** — writes to `dev/reports/status.json` after every run (status, timestamp, attempts, consecutive errors)
- **Webhook delivery** — optional `--notify <url>` to POST results to Slack/Discord/any webhook
- **Logging** — timestamped entries in `dev/reports/<check>/cron.log`

Usage: `claude-monitor-run.sh <check-name> <prompt> [--notify <webhook_url>]`

## Phase 0: Detect OS

```bash
OS="$(uname -s 2>/dev/null || echo Windows)"
```

| Result | OS | Scheduler |
|--------|----|-----------|
| `Linux` | Linux | cron (`crontab`) |
| `Darwin` | macOS | cron (`crontab`) |
| `MINGW*` / `MSYS*` / `Windows` | Windows | Task Scheduler (`schtasks`) |

Store the OS for use in Phase 3.

## Phase 1: Current state

**Linux/macOS:**
```bash
crontab -l 2>/dev/null | grep "# claude-monitor:" || echo "No monitors active."
```

**Windows:**
```bash
schtasks /query /fo LIST 2>/dev/null | grep "claude-monitor" || echo "No monitors active."
```

Also show structured status if available:
```bash
if [ -f dev/reports/status.json ]; then
  jq -r 'to_entries[] | "\(.key): \(.value.status) | last: \(.value.lastRunAt) | errors: \(.value.consecutiveErrors)"' dev/reports/status.json
fi
```

Tell the user what's currently scheduled and last run results.

## Phase 2: Configure intervals

| Check | Default | What it does |
|-------|---------|-------------|
| `/security` | Every 4 days | RLS audit + OWASP scan + secrets scan on git changes |
| `/performance` | Every 4 days | Frontend + backend + architecture checks on git changes |
| `/audit` | Every 7 days | Dependency vulnerabilities + code quality + dead code |
| `/sentry` | Every 1 day | Production error triage + root cause analysis + fix recommendations |
| `/drift` | Every 3 features | Pattern drift detection across recent builds (see below) |
| `/heal` | Every 1 day (9pm) | Reads ALL reports, fixes critical/high on a branch, scores confidence, emails verdict |
| `blog-writer` | Every 7 days | Researches industry via Tavily, writes SEO+AEO draft, saves to DB, emails admin |

**Conditional checks** — only offer if the feature is built:
- `blog-writer`: Only show if `docs/built/blog.md` exists AND `TAVILY_API_KEY` is in `webapp/.env`

If interactive (no `--defaults`), ask the user:

> **Monitor configuration:**
>
> 1. **Security checks** — scans for RLS gaps, OWASP vulnerabilities, leaked secrets
>    Default: every 4 days. Your preference? (1-7 days, or skip)
>
> 2. **Performance checks** — audits against Vercel/Supabase/Next.js best practices
>    Default: every 4 days. Your preference? (1-7 days, or skip)
>
> 3. **Dependency audit** — checks for outdated packages, vulnerabilities, dead code
>    Default: every 7 days. Your preference? (3-14 days, or skip)
>
> 4. **Sentry error triage** — fetches production errors, root cause analysis, fix recommendations
>    Default: every 1 day. Your preference? (1-3 days, or skip)
>
> 5. **Drift detection** — checks recent features for pattern divergence, stale docs, inconsistencies
>    Default: every 6 hours. Your preference? (4-24 hours, or skip)
>
> 6. **Heal** — reads ALL reports, creates a branch, fixes critical/high issues, tests, scores confidence, emails verdict
>    Default: every 1 day (9pm). Your preference? (1-3 days, or skip)
>    NOTE: Heal NEVER pushes to main. It creates a `heal/*` branch for you to review and merge.
>
> 7. **Blog writer** *(only if blog is built)* — researches industry, writes SEO+AEO optimized draft, saves to DB, emails admin
>    Default: every 7 days (Monday 9am). Your preference? (3-14 days, or skip)
>
> Also ask: **Notifications?** (optional, press enter to skip)
> - Telegram: `telegram:<bot_token>:<chat_id>` (get from @BotFather + channel ID)
> - Slack: paste incoming webhook URL
> - Discord: paste webhook URL
> - Other: any URL that accepts JSON POST
>
> Enter intervals or press enter for defaults.

## Phase 3: Install scheduled tasks

First, detect the project directory, claude binary, and runner script:

```bash
PROJECT_DIR="$(pwd)"
CLAUDE_BIN="$(which claude)"
RUNNER="$PROJECT_DIR/.foundry/scripts/claude-monitor-run.sh"
```

Verify the runner exists and is executable:
```bash
if [ ! -x "$RUNNER" ]; then
  echo "ERROR: Runner script not found at $RUNNER"
  echo "Expected at .foundry/scripts/claude-monitor-run.sh"
  exit 1
fi
```

Ensure report directories exist:

```bash
mkdir -p dev/reports/security dev/reports/performance dev/reports/audit dev/reports/sentry dev/reports/drift dev/reports/heal dev/reports/blog-writer
```

### Linux / macOS (cron)

**Cron expression mapping:**

| Interval | Cron expression | When |
|----------|----------------|------|
| Every 1 day | `0 9 * * *` | Daily at 9am |
| Every 2 days | `0 9 */2 * *` | Every 2 days at 9am |
| Every 3 days | `0 9 */3 * *` | Every 3 days at 9am |
| Every 4 days | `0 9 */4 * *` | Every 4 days at 9am |
| Every 7 days | `0 9 * * 1` | Every Monday at 9am |
| Every 14 days | `0 9 1,15 * *` | 1st and 15th at 9am |
| Every 4 hours | `0 */4 * * *` | Every 4 hours |
| Every 6 hours | `0 */6 * * *` | Every 6 hours |
| Every 8 hours | `0 */8 * * *` | Every 8 hours |
| Every 12 hours | `0 */12 * * *` | Twice daily |
| Every 24 hours | `0 9 * * *` | Daily at 9am |

First, resolve paths and store existing non-monitor cron entries:

```bash
PROJECT_DIR="$(pwd)"
CLAUDE_BIN="$(which claude)"
RUNNER="$PROJECT_DIR/.foundry/scripts/claude-monitor-run.sh"
EXISTING=$(crontab -l 2>/dev/null | grep -v "# claude-monitor:" || true)
```

Then write ALL entries (existing + new monitors) via heredoc. The heredoc is NOT quoted (`<<CRONTAB` not `<<'CRONTAB'`) so that variables expand to resolved absolute paths:

```bash
crontab - <<CRONTAB
${EXISTING}
0 9 * * * ${RUNNER} sentry "/sentry" # claude-monitor: sentry
0 9 */4 * * ${RUNNER} security "/security" # claude-monitor: security
0 9 */4 * * ${RUNNER} performance "/performance" # claude-monitor: performance
0 9 * * 1 ${RUNNER} audit "/audit" # claude-monitor: audit
0 */6 * * * ${RUNNER} drift "/drift" # claude-monitor: drift
0 21 * * * ${RUNNER} heal "/heal" # claude-monitor: heal
0 9 * * 1 ${RUNNER} blog-writer "Use the blog-writer skill. Write one new blog post for this project." # claude-monitor: blog-writer
CRONTAB
```

If the user provided a webhook URL, append `--notify <url>` to each runner call.

**Conditional line:** Only include the `blog-writer` cron line if `docs/built/blog.md` exists. If blog isn't built, omit it from the crontab.

### Windows (Task Scheduler)

For each enabled check, create a scheduled task:

```bash
# Example for /sentry daily at 9am:
schtasks /create /tn "claude-monitor-sentry" /tr "cmd /c ${RUNNER} sentry \"/sentry\"" /sc daily /st 09:00 /f

# Example for /security every 4 days at 9am:
schtasks /create /tn "claude-monitor-security" /tr "cmd /c ${RUNNER} security \"/security\"" /sc daily /mo 4 /st 09:00 /f
```

## Phase 4: Verify & Confirm

**Linux/macOS:**
```bash
crontab -l | grep "# claude-monitor:"
```

**Windows:**
```bash
schtasks /query /fo LIST | grep "claude-monitor"
```

Present to the user:

> **Monitors installed:**
>
> | Check | Interval | Schedule | Report location |
> |-------|----------|----------|-----------------|
> | Security | every {N} days | `{cron/schtasks}` | dev/reports/security/ |
> | Performance | every {N} days | `{cron/schtasks}` | dev/reports/performance/ |
> | Audit | every {N} days | `{cron/schtasks}` | dev/reports/audit/ |
> | Sentry | every {N} days | `{cron/schtasks}` | dev/reports/sentry/ |
> | Drift | every {N} hours | `{cron/schtasks}` | dev/reports/drift/ |
> | Heal | every {N} days | `{cron/schtasks}` | dev/reports/heal/ |
>
> **Runner features:** retry with backoff (3 attempts), structured status in `dev/reports/status.json`, timestamped logs.
>
> Heal creates `heal/*` branches — it NEVER pushes to main. Review and merge manually.
>
> These run via {cron / Task Scheduler} — they persist across sessions and reboots.
> Uses your existing Claude Code OAuth login (no API key needed).
> Computer must be awake at the scheduled time for the task to run.
>
> - `/monitor --status` — check scheduled tasks + last run results
> - `/monitor --stop` — remove all monitor tasks
> - `/monitor --test sentry` — run sentry check now through the runner (tests everything end-to-end)
> - Run `/security`, `/performance`, `/audit`, `/sentry` anytime for a manual check
> - Run `/heal` to fix all critical/high issues from reports (creates a branch, never touches main)
> - Run `/heal --dry-run` to preview what would be fixed
> - Run `/fix-issue` after a sentry report to interactively fix errors

## If `--test <check>`:

Run the runner script directly to test end-to-end (retry, status.json, logging):

```bash
PROJECT_DIR="$(pwd)"
RUNNER="$PROJECT_DIR/.foundry/scripts/claude-monitor-run.sh"
```

Map the check name to its prompt:
| Check | Prompt |
|-------|--------|
| `sentry` | `/sentry` |
| `security` | `/security` |
| `performance` | `/performance` |
| `audit` | `/audit` |
| `drift` | `/drift` |
| `heal` | `/heal` |
| `blog-writer` | `Use the blog-writer skill. Write one new blog post for this project.` |

Then run:
```bash
"$RUNNER" <check> "<prompt>"
```

After it finishes, show the user:
1. The exit code
2. The last entry in `dev/reports/<check>/cron.log`
3. The check's entry in `dev/reports/status.json`

This tests the exact same code path as the cron job — same runner, same retry logic, same status tracking.

## If `--stop`:

**Linux/macOS:**
```bash
crontab -l 2>/dev/null | grep -v "# claude-monitor:" | crontab -
```

**Windows:**
```bash
schtasks /delete /tn "claude-monitor-sentry" /f 2>/dev/null
schtasks /delete /tn "claude-monitor-security" /f 2>/dev/null
schtasks /delete /tn "claude-monitor-performance" /f 2>/dev/null
schtasks /delete /tn "claude-monitor-audit" /f 2>/dev/null
schtasks /delete /tn "claude-monitor-drift" /f 2>/dev/null
schtasks /delete /tn "claude-monitor-heal" /f 2>/dev/null
schtasks /delete /tn "claude-monitor-blog-writer" /f 2>/dev/null
```

Confirm to user that all monitors are removed.

## If `--status`:

**Linux/macOS:**
```bash
crontab -l 2>/dev/null | grep "# claude-monitor:" || echo "No monitors active."
```

**Windows:**
```bash
schtasks /query /fo LIST 2>/dev/null | grep "claude-monitor" || echo "No monitors active."
```

Then show structured run history:
```bash
if [ -f dev/reports/status.json ]; then
  jq -r 'to_entries | sort_by(.value.lastRunAt) | reverse | .[] | "\(.key)\t\(.value.status)\t\(.value.lastRunAt)\tattempts=\(.value.attempts)\terrors=\(.value.consecutiveErrors)"' dev/reports/status.json | column -t -s $'\t'
else
  echo "No runs yet. Use '/monitor --test sentry' to test."
fi
```

Show a formatted table of what's scheduled and their last results.
