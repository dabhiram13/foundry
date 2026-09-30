# Authorization derives only from what the server signed

**Goal.** A user can never grant themselves more than the server decided they have. Every entry point defends itself. No secret crosses into the client's hands.

**Reasoning.** Three exploits in this codebase's own history share one shape: the check trusted something the caller controlled, or existed at one boundary and was assumed at another. Admin functions read `user_metadata.user_role` — settable by any authenticated user in one call. Credit functions accepted the subject's id as a parameter and were executable by every authenticated role, so anyone could refund themselves or drain a stranger. Edge functions skipped the redirect validation the main procedures had, so the check existed and protected nothing. None of these were missing rules; each was a rule applied at one boundary and assumed at another. The judgment: **identity and entitlement are read from server-signed claims and server-owned tables only, and every callable surface re-checks — because the attacker chooses which surface to call.**

**Priority.**
1. Fail closed. An absent claim, an unmatched row, a missing grant is a denial — never a default grant. (For plan entitlement, "denial" means the lowest tier that exists, so the user keeps the product and gains no paid privilege — see `entitlement`.)
2. Least privilege on the caller before the function. A definer-rights function is an open door: restrict who may execute it before refining what it does.
3. Deny by default at the data layer (row policies), then confirm at the API layer. The client never decides what to hide.
4. Silence over information. A login failure, a reset request, a database error tells the user nothing an attacker could use.
5. Speed last — and the signed claim is also the fastest source, so this rarely costs anything.

**Good.**
- Middleware reads signed claims only. No database call runs on every request; its admin redirect is a courtesy, and the procedure enforces the real check.
- A function that takes a user id either runs only as the service role, or binds the id to the caller's own inside its body.
- Plan and billing identity live where the user cannot write: a read-only mirror of the payment provider, resolved by a server function — never a column on a profile the user can update.
- Every definer-rights function pins an empty search path, qualifies every table, grants execute to exactly the role that needs it, and revokes it from everyone else.
- Mutation inputs drop unknown keys. The shape the server accepts is the shape it declared.
- A redirect target is validated as a relative path at every surface that redirects — including the surfaces added later.

**Counterexamples.**
- An admin check that reads the token's user-editable metadata (`user_metadata.user_role`) instead of the server-set claim. The escalation is one API call.
- `refund_credits(p_user_id, p_amount)` executable by `authenticated`. Infinite self-refund.
- A profile table whose select policy is `true`: every user's email harvested from the browser console.
- A rate limiter whose fallback key is a fresh random id per request — a limit that never limits.
- A public caller built on the service-role client "for static pages", one import away from bypassing every row policy.
- Forwarding the database's error text to the client: table names, constraint names, whether an email exists.
- A claim reader looking for `user_name` when the hook writes `name`. Both return null forever, and the verify step checks the correct names, so it never notices.

**Evidence.** For every new table, function, procedure, and route: name the role that can reach it and the claim or policy that gates it. Prove one negative per boundary by exercising it, not by reading it — another user's row is invisible, a free user's write is refused, a self-supplied id is ignored, a foreign redirect is rejected. Then, per surface:
- Every namespace the browser calls is registered in **both** `webapp/lib/orpc/contracts/index.ts` (the `protected:` block, lines 17–23) and the router in `webapp/lib/orpc/procedures/protected.ts` (lines 68–76). The browser link is `new OpenAPILink(contract, …)` (`webapp/lib/orpc/client.ts:24`), so a namespace in the router but absent from the barrel typechecks, lints, builds — and 404s from the browser. Exercise one browser-side call per namespace; a green `tsc` is not evidence. (`jobs` and `settings` sit in the router and not the barrel because nothing calls them from the browser — that precedent transfers only to namespaces with no browser caller.)
- A row that does not exist and a row owned by someone else return byte-identical `NOT_FOUND` — same code, same message, same status, same body. Exercise both with one caller and diff the two responses.
- Every write policy names its role (`TO authenticated` — never omitted, `.foundry/references/source-docs/supabase/security.md:245`), carries `WITH CHECK` as well as `USING`, and uses `true` on neither (`.foundry/references/source-docs/supabase/security.md:28`). Every predicate wraps the claim as `(select auth.uid())`, evaluated once per statement instead of once per row (`library/skills/supabase-postgres-best-practices/references/security-rls-performance.md:25`). Read the applied policies back from the database, not from the migration file.
- Any cap the procedure enforces — row limit, page size, date span — is enforced inside the SQL too whenever the function is `SECURITY DEFINER` with execute granted to `authenticated`: PostgREST publishes it at `/rest/v1/rpc/{name}`, so a validator-only cap protects nothing on the path the migration just created. Exercise the cap on that path, not only through the procedure.
- A row its owner may edit but must not re-key — author, `created_at`, a status the server sets, a path the server signs — is protected by a trigger, not by the shape of the input schema. Exercise the forbidden column change as the owner and record the rejection.
- List every boundary you could not exercise as UNKNOWN.
- `WITH CHECK` pins the initial state of every client-settable column, not only ownership: an INSERT policy for a job row reads `user_id = (select auth.uid()) AND status = 'queued' AND file_path IS NULL` — with ownership alone, a caller holding the anon key inserts a row that is already `complete` with someone else's `file_path`. Read the policy back and try the forged insert.
- A signed storage URL is built from a path the server derives (`${user.id}/${jobId}.csv`) or verifies against the caller's prefix — never from a path read off the row. Exercise it with a row whose `file_path` was edited.
