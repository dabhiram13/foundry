# next-browser — Agent Testing Reference

CLI tool for browser interaction from agents. Stateless commands against a long-lived browser daemon.

## Setup

```bash
# Install (once per machine)
pnpm add -g @vercel/next-browser
playwright install chromium
```

## Browser Lifecycle

```bash
npx next-browser open http://localhost:3000          # launch + navigate
npx next-browser open http://localhost:3000 --cookies-json auth.json  # with auth
npx next-browser close                                # kill daemon
```

## Core Loop: Snapshot → Act → Verify

```bash
# 1. See what's on screen (accessibility tree with refs)
npx next-browser snapshot
# Output:
# - navigation "Main"
#   - link "Home" [ref=e0]
#   - link "Dashboard" [ref=e1]
# - main
#   - heading "Scripts"
#   - button "Generate" [ref=e2]

# 2. Interact using refs
npx next-browser click e2
npx next-browser fill e3 "My Script Title"

# 3. Verify result
npx next-browser snapshot    # re-snapshot after action
npx next-browser screenshot  # save visual evidence
```

## Navigation

| Command | Use when |
|---------|----------|
| `goto <url>` | Full page navigation (new document) |
| `push [path]` | Client-side navigation (SPA, no reload) |
| `back` | Test back-button behavior |
| `reload` | Verify data persists after refresh |

## Inspection

| Command | What it gives you |
|---------|-------------------|
| `snapshot` | Accessibility tree with `[ref=eN]` markers — the primary way to find elements |
| `tree` | Full React component hierarchy (IDs, keys) |
| `tree <id>` | Single component: props, hooks, state, source location |
| `errors` | Build + runtime errors on current page |
| `logs` | Dev server log output |
| `network [idx]` | Network requests, or inspect one (headers, body) |
| `screenshot` | Viewport PNG to temp file (`--full-page` for entire page) |
| `preview [caption]` | Screenshot + open in viewer (accumulates) |

## Interaction

| Command | Notes |
|---------|-------|
| `click <ref\|text\|selector>` | Real pointer events (works with Radix, Headless UI) |
| `fill <ref\|selector> <value>` | Text input or textarea |
| `eval [ref] <script>` | Run JS in page context |
| `viewport [WxH]` | Show or set viewport size |

## Performance (perf-tester uses this)

```bash
# Core Web Vitals + React hydration in one pass
npx next-browser perf http://localhost:3000/protected/scripts
# Output: TTFB, LCP, CLS, hydration timing, commit timing

# PPR shell analysis
npx next-browser ppr lock
npx next-browser goto http://localhost:3000/protected/scripts
npx next-browser preview "PPR shell"
npx next-browser ppr unlock
# Output: boundary count, dynamic holes, static shell analysis
```

## Agent Interaction Patterns

### Pattern 1: Journey Verification
```bash
# Follow a journey step from the test brief
npx next-browser open http://localhost:3000/protected/videos
npx next-browser snapshot                    # verify page loaded
npx next-browser click "My Video"            # click by text
npx next-browser snapshot                    # verify detail page
npx next-browser click e5                    # "Generate Script" button
npx next-browser snapshot                    # verify redirect to /scripts
# Look for: loading skeleton, optimistic card, status updates
```

### Pattern 2: Form Flow
```bash
npx next-browser goto /protected/scripts/new
npx next-browser snapshot                    # see form fields
npx next-browser fill e1 "Script Title"
npx next-browser fill e2 "Description here"
npx next-browser click "Save"               # submit
npx next-browser snapshot                    # verify success state
```

### Pattern 3: Responsive Check
```bash
npx next-browser viewport 375x812           # mobile
npx next-browser screenshot
npx next-browser viewport 768x1024          # tablet
npx next-browser screenshot
npx next-browser viewport 1440x900          # desktop
npx next-browser screenshot
```

### Pattern 4: Error State
```bash
npx next-browser goto /protected/scripts/nonexistent-id
npx next-browser snapshot                    # should show 404 or error state
npx next-browser errors                      # check for unhandled errors
```

## Key Rules

- Always `snapshot` after navigation or click — refs get invalidated
- Use `errors` after every page load to catch silent failures
- Use `network` to debug failed API calls
- `screenshot` is mandatory evidence for each journey step
- `tree <id>` to inspect React component state when UI seems wrong
