# Data is fetched where it is owned, cached under a name, and every effect happens once

**Goal.** Each piece of data has one owner that fetches it, one name that caches it, and one path that stales it — so a write anywhere is visible everywhere it should be, and nothing runs twice.

**Reasoning.** The costliest bugs here were not wrong data; they were data fetched in the wrong place. A page that fetched on the client paid two round trips — server auth, then client HTTP — and showed a spinner on every visit. A boundary that awaited the whole page showed nothing until everything was ready. A cache invalidated by habit ("refresh after mutate") re-rendered and read the same stale entry, because nothing had told the cache the entry was stale. Background work that did two things in one step did one of them twice on retry. The judgment: **the server owns fetching and streams each unit independently; the cache is keyed by an explicit name that the write invalidates; interactive code lives on the smallest leaf that needs it; and every side effect is isolated so a retry is safe.**

**Priority.**
1. Correctness of the read after a write beats the speed of the write. Name the tag; invalidate the name.
2. Server first. A client fetches only what cannot exist at render time: further pages, live subscriptions, keystroke search.
3. Stream per unit, not per page. Each self-contained section owns its promise, its boundary, its fallback.
4. Push interactivity down. A client directive on a page or layout makes the whole subtree pay for one button.
5. Once beats fast. A step that writes storage and the database is two steps; a webhook has a replay guard; a loop reads its state from what the runtime returns, never from a closure.

**Good.**
- A server wrapper creates a promise without awaiting it, hands it to a boundary with a fallback, and a leaf client component unwraps it. Sections stream in parallel; the shell paints first.
- A cached data function declares its lifetime and its tag in its body; the mutation's server action invalidates that same tag and the client refreshes. One name, both sides.
- A cursor list orders by a unique tiebreaker, so equal timestamps cannot skip rows.
- A background function receives ids in its event and looks the rest up inside the step. Payloads stay small; each step returns only what the next one needs.
- A field that changes type is changed everywhere in one pass — every reader found first, one type-check at the end — not file by file, discovering the next breakage.

**Counterexamples.**
- Copying server data into local state with an effect, then rendering the copy. Now there are two truths and one is stale.
- A mutation that refreshes the page without invalidating the tag: the page re-renders and reads the same cached row.
- A tag on the write that does not match the tag on the read — stale reads after every save, invisible in review.
- Calling a per-request API (cookies, headers, search params) inside a cached function: a build error at best, a cross-user cache leak at worst.
- One step that uploads a file and writes its row: on retry the file uploads twice, or the row is written for a file that failed.
- A realtime channel on the whole table, pushing every change to every client.

**Evidence.** For every fetch, record its tier (public, per-user, dynamic) and its tag; for every mutation, the tag it invalidates — the two lists must match. Exercise a write and confirm the read reflects it without a manual reload. For lists, exercise a page boundary with duplicate sort values. For background work, exercise one retry and confirm no duplicate effect. Then:
- Every read inside a job is paged. A bare `.select()` in a `step.run()` is truncated at PostgREST's row ceiling with no error, so the job finishes on partial data and reports success. Exercise it above the ceiling and compare the row count the job wrote against the row count in the table; record both numbers.
- No step returns bulk data. Only step results are memoized into run state (`.foundry/references/source-docs/patterns/backend/inngest.md:277`) and events carry ids, not payloads (`:283`) — so a step stores the rows, the file or the CSV and returns the key, the count and the bytes. Record what each step returns; a whole row array or a whole document crossing a boundary is the FAIL.
- Every balance, quota or allocation read names its no-row branch. The shipped fallback is `data?.balance ?? allocation` (`webapp/lib/orpc/procedures/credits.ts:46`): a brand-new account with no row reads its plan allocation, not zero. Exercise the read as a user with no row and record the number the page renders — two surfaces reading the same balance must render the same number.
- After a migration, `webapp/lib/supabase/database.types.ts` is regenerated and the new table or function is greppable in it before any query is written. No npm script does this (`webapp/package.json` has none) — the generator is the `supabase` MCP `generate_typescript_types`. A query that needs `as unknown as X` to compile is the evidence the file is stale, not a workaround.
- Anything not exercised is UNKNOWN.
- A CSV export neutralises formula injection: any field starting with `=`, `+`, `-`, `@`, tab or CR is prefixed with `'` — open the file in a spreadsheet with a project named `=HYPERLINK(...)`. Both export scopes emit the same pinned header (RFC 4180, `\r\n`, UTF-8 BOM).
- A job persists what it counted (`row_count`), so an empty export and a truncated one are distinguishable after the fact; the UI shows a dash while `row_count` is null and `0` only when the count is `0`.
