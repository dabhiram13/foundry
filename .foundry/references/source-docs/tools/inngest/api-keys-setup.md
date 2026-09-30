# Inngest - API Keys and Environment Setup

## Required Keys

| Key | Where to get it | When needed |
|---|---|---|
| **Event Key** (`INNGEST_EVENT_KEY`) | Inngest Cloud dashboard > Settings > Keys | Production -- required to send events |
| **Signing Key** (`INNGEST_SIGNING_KEY`) | Inngest Cloud dashboard > Settings > Keys | Production -- secures communication between your app and Inngest |

Neither key is needed for local development with the Dev Server.

## Development Setup

### Inngest Dev Server

```bash
npx inngest-cli@latest dev
```

Runs at `http://localhost:8288`. Provides a local dashboard, event browser, and function runner. No API keys needed.

Your `.env` for development:

```env
# Not strictly needed -- auto-detected when NODE_ENV=development
INNGEST_DEV=1
```

The SDK auto-detects dev mode via `NODE_ENV`. Explicitly set `INNGEST_DEV=1` only if auto-detection fails (e.g., custom environments).

### Docker / Custom Network

When your app runs in Docker and the Dev Server runs on the host:

```env
INNGEST_DEV=1
INNGEST_BASE_URL=http://host.docker.internal:8288
```

## Production Setup

### .env.production (or hosting provider env vars)

```env
INNGEST_EVENT_KEY=your-event-key-from-dashboard
INNGEST_SIGNING_KEY=your-signing-key-from-dashboard
```

Do **not** set `INNGEST_DEV` in production (or explicitly set `INNGEST_DEV=0`).

### Signing Key Rotation

When rotating signing keys:

1. Generate a new signing key in the Inngest dashboard
2. Set `INNGEST_SIGNING_KEY` to the new key
3. Set `INNGEST_SIGNING_KEY_FALLBACK` to the old key
4. Deploy
5. After confirming everything works, remove `INNGEST_SIGNING_KEY_FALLBACK`

Requires SDK v3.18.0+.

## Branch Environments

For preview/staging deployments:

```env
INNGEST_ENV=staging
# or
INNGEST_ENV=preview-pr-123
```

Auto-detected on some platforms (Vercel, Netlify). Set manually on others.

## All Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `INNGEST_EVENT_KEY` | -- | Event key for sending events to Inngest Cloud |
| `INNGEST_SIGNING_KEY` | -- | Signing key for secure request verification |
| `INNGEST_SIGNING_KEY_FALLBACK` | -- | Old signing key during rotation (v3.18.0+) |
| `INNGEST_DEV` | auto | `1` = dev mode, `0` = cloud mode, or a URL like `http://localhost:8288` |
| `INNGEST_BASE_URL` | -- | Override Inngest host (e.g., `http://host.docker.internal:8288` for Docker) |
| `INNGEST_ENV` | auto | Branch environment name |
| `INNGEST_SERVE_HOST` | auto | Your app's externally-accessible host |
| `INNGEST_SERVE_PATH` | auto | Path to your Inngest route (e.g., `/api/inngest`) |
| `INNGEST_LOG_LEVEL` | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `silent` |
| `INNGEST_STREAMING` | `false` | `allow`, `force`, or `false`. Helps with restrictive request timeouts. |

## Configuration in Code (Override Env Vars)

```typescript
import { Inngest } from "inngest";

const inngest = new Inngest({
  id: "my-app",
  // Override env vars programmatically:
  eventKey: "custom-key",
  isDev: false,
  env: "staging",
});
```

```typescript
import { serve } from "inngest/next";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [/* ... */],
  // Override serve-specific config:
  signingKey: "custom-signing-key",
  serveHost: "https://my-app.com",
  servePath: "/api/inngest",
  streaming: "allow",
});
```

## Vercel-Specific Notes

- `INNGEST_SIGNING_KEY` must be set in Vercel's environment variables (Settings > Environment Variables)
- `INNGEST_EVENT_KEY` must also be set there
- Branch environments are auto-detected via `VERCEL_ENV` and `VERCEL_GIT_COMMIT_REF`
- For Vercel's 10s timeout on Hobby plans, consider enabling streaming: `INNGEST_STREAMING=allow`

## Pitfalls

- **Missing signing key in production**: Your app will fail to sync with Inngest Cloud. Functions will not execute. The error may not be obvious -- check Inngest dashboard for sync failures.
- **`INNGEST_DEV=1` in production**: Disables signature verification. Anyone who discovers your `/api/inngest` endpoint can execute functions. Never set this in production.
- **Event key vs Signing key**: They serve different purposes. The event key authorizes sending events. The signing key verifies the identity of requests between your app and Inngest. Both are required.
- **Streaming on Vercel**: Enabling `INNGEST_STREAMING=allow` helps avoid Vercel's function execution timeout for long-running steps. Without it, steps are limited to your plan's timeout (10s Hobby, 60s Pro).
