# Realtime Pattern

Supabase Realtime is powerful and expensive. Filter every subscription.

## Decision tree

| Situation | Strategy |
|---|---|
| <100 concurrent listeners, per-entity updates | Supabase Realtime filtered channel |
| >100 listeners on same channel | Polling with interval, or Inngest push to per-user channel |
| "Live feed" feeling, no true real-time need | Polling every 10–30s |
| Status updates triggered by Inngest workers | Inngest → `.update()` → RLS-scoped Realtime filter |
| Background job progress | Client polls `/api/rpc/jobs/{id}` with backoff |

## Filtered channel template

```ts
'use client'
import { createClient } from '@/lib/supabase/client'
import { useEffect } from 'react'

export function useCommentStream(postId: string, onInsert: (row: Comment) => void) {
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`post:${postId}:comments`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'comments',
          filter: `post_id=eq.${postId}`,
        },
        (payload) => onInsert(payload.new as Comment)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [postId, onInsert])
}
```

## Rules

1. ALWAYS include a `filter` — never subscribe to full table changes.
2. Scope channel name by entity: `post:{id}:comments`, not `comments`.
3. Specify exact `event` (`INSERT` | `UPDATE` | `DELETE`) — never `*`.
4. On reconnect, re-fetch current state from the server. Don't trust the missed-events window.
5. RLS applies to realtime — listeners only receive rows they'd see in a SELECT.
6. Clean up the channel in the effect's return. Leaked channels = dead connections + memory.

## When to skip Realtime

- Cross-user notifications: write a `notifications` row via Inngest, client polls or subscribes to its own filtered channel.
- Background job status: client polls `/api/rpc/jobs/{id}` every 2s with exponential backoff.
- Dashboards: refresh on user action or 30–60s interval — real-time rarely adds value.

## Gotchas

- Realtime over RLS can be slow — filter columns must be indexed.
- `UPDATE` events fire on every column change. If only specific fields matter, filter on the client after receiving.
- Replication slots leak on abandoned subscriptions. Always clean up in the effect return.
- Supabase Realtime has a per-project concurrent-channel cap — design for it.
