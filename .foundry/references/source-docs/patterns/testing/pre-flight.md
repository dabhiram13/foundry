# Pre-Flight Checks

Run before writing any test. Catches infrastructure gaps early instead of wasting turns debugging.

## API Tester Pre-Flight

```bash
cd webapp

# 1. Schema — do the tables exist?
# Read procedure code, note which tables it queries, verify they exist
# If missing: BLOCK with "PREFLIGHT FAILED: missing tables [list]"
# Do NOT migrate the DB yourself — that's db-architect scope

# 2. HTTP methods — are all verbs exported?
grep -n 'export.*GET\|export.*POST\|export.*PUT\|export.*DELETE' app/api/rpc/\[\[...rest\]\]/route.ts
# If DELETE/PUT missing: BLOCK with "PREFLIGHT FAILED: missing HTTP method exports"

# 3. Inngest — is the dev server running? (if feature uses background jobs)
curl -s http://localhost:8288/v1/health > /dev/null 2>&1
# If not running: start it
npx inngest-cli@latest dev &
sleep 3
# If still not running: write test.fixme stubs, don't silently skip

# 4. Seed data — are tables populated?
# If feature has a create endpoint: seed via API calls in beforeAll
# If NO create endpoint exists: use Supabase MCP to INSERT rows directly
#   → mcp__supabase__execute_sql: INSERT INTO public.{table} (...) VALUES (...) RETURNING id
#   → Get owner user ID: SELECT id FROM auth.users WHERE email = 'test-owner@example.dev'
#   → For Playwright test files: use createClient(@supabase/supabase-js) + SUPABASE_SERVICE_ROLE_KEY
# Each spec file must be self-sufficient
```

## Designer Completion Gate (flow-tester only)

Before walking any journey, check if the designer phase completed:

```bash
# Count stub components vs real components
STUBS=$(grep -rl "TODO: designer\|TODO:\s*designer\|placeholder" webapp/features/{feature}/components/ 2>/dev/null | wc -l)
TOTAL=$(ls webapp/features/{feature}/components/*.tsx 2>/dev/null | wc -l)
if [ "$STUBS" -gt "$((TOTAL / 2))" ]; then
  echo "BLOCKED: designer phase incomplete — $STUBS/$TOTAL components are stubs"
  # Mark ALL journeys as FAIL (not implemented) and stop
fi
```

If >50% of components are stubs, abort flow testing immediately. Don't waste turns walking through placeholder divs.

## Build Health Check (both testers)

A broken import in ANY feature blocks the entire test suite. Before writing tests:

```bash
cd webapp && npx tsc --noEmit 2>&1 | head -20
```

If `tsc` fails, the api-tester may apply a MINIMAL fix (comment out the broken import, stub the missing export) to unblock testing. Mark as TEMPORARY in decisions.md. Do NOT remap function names or change behavior.

## Flow Tester Pre-Flight

```bash
cd webapp

# 1. Dev server — resolve via portless
APP_NAME=$(basename "$(git rev-parse --show-toplevel)")
DEV_URL=$(npx portless get "$APP_NAME" 2>/dev/null || echo "")
if [ -z "$DEV_URL" ]; then
  npm run dev &
  sleep 5
  DEV_URL=$(npx portless get "$APP_NAME" 2>/dev/null || echo "")
fi

# 2. Auth state — login all personas
AUTH_STATE="tests/e2e/.auth/state.json"
[ ! -f "$AUTH_STATE" ] && npx playwright test --project=setup

# 3. Browser — open with auth
npx next-browser open "$DEV_URL" --cookies-json "$AUTH_STATE"

# 4. Warm-up — absorb cold-load JWKS race
npx next-browser goto /protected/dashboard
npx next-browser snapshot
npx next-browser errors
# If errors, retry once — first navigation sometimes fails on auth cache warm-up

# 5. Element check — before each journey, snapshot and verify key elements exist
# If element from brief is absent: log UPSTREAM-GAP, mark journey FAIL (not implemented)
```

## Scope Boundaries

| If you find... | Do | Don't |
|----------------|-----|-------|
| Missing DB tables | BLOCK, report | Migrate yourself |
| Missing HTTP method export | BLOCK, report | Add the export |
| Inngest not running | Start it | Skip Inngest tests silently |
| Empty tables | Seed via API in beforeAll, or via Supabase service role client / MCP if no create endpoint | Leave empty and hope for the best |
| Placeholder component | Log UPSTREAM-GAP, skip journey | Implement the component |
| Missing UI element from brief | Mark FAIL (not implemented) | Count as PASS |
