# Preserve the user's mental model during asynchronous work

**Goal.** Loading reduces uncertainty without destroying useful context or allowing a duplicate action. The user always knows where their thing is and what is happening to it.

**Reasoning.** The user built a mental model from what was on screen — the scroll position, the filter they typed, the card they were watching. Async work that erases it costs them the model; async work that leaves the screen unchanged costs them the knowledge that anything happened. Both are failures, and the second looks fine in a screenshot. Six rules used to cover this ("always a skeleton", "never a blank page", "disable the button", "show a spinner") and they defeated each other: a page-level skeleton *is* the blank page, and a disabled button makes retry impossible after the request fails. The judgment is one sentence: **content that is already useful stays; feedback appears next to the control that caused the work.**

**Priority.**
1. Preventing a duplicate write beats showing progress.
2. Keeping already-useful content visible beats showing a loading affordance.
3. A recoverable error beats a silent one. When correctness and feedback conflict, correctness wins and the feedback moves closer to the control.
4. First paint is the only moment a skeleton is right. After that the data exists — dim it, never replace it.

**Good.**
- A save button stays in place, shows pending, blocks a second submit, then exposes success or a retryable error — inline, not as a toast that vanishes.
- A filter change keeps the old results visible at reduced opacity with a small indicator. The filter bar itself never becomes a skeleton, never loses focus, never resets scroll.
- A long-running job (generation, import, analysis) puts a pending card in the grid the instant the user triggers it. The card polls, then swaps its own content in place. On failure the card offers retry. The grid never changes size.
- An empty list distinguishes "you have nothing yet" (first visit — invite to create) from "nothing matches" (a filter produced no results — invite to clear it).
- After async completion or a deletion, focus moves to the result, the next item, or the container — never to the document body.

**Counterexamples.**
- Replacing the whole screen with a spinner for a local refresh. Recorded cost: 30 minutes to unbuild a page that swapped visible content for skeletons on every refetch.
- Keying a boundary on the filter state so every keystroke unmounts the results, the filter bar, and the user's scroll position. 40 minutes.
- Showing success before the server has committed the change.
- A pulsing skeleton that draws the eye to the loading instead of the content. Skeletons are calm, solid, and shaped like what they stand in for.
- One "No results" screen for both a new user and an over-filtered list — the new user is told to clear a filter they never set.
- A finished wizard, an expired invite, a completed job with no designed screen. Lifecycle end states are real states.

**Evidence.** For every async surface, exercise and record: first load (skeleton matches the final layout), slow (content stays, indicator near the control), success, error with retry, a second submit while pending (blocked), both empty states, and the narrow screen at 375px — including what is inside any sheet that replaces a dialog, table, or panel. Record where focus lands after each transition. A state that could not be exercised is UNKNOWN, not PASS.
- Polling ends three ways — terminal status, an attempt cap, and `document.hidden` pausing it — and a failed poll keeps the last known state on screen with a quiet "couldn't refresh — retrying" line, never a blank page. A time-limited link becomes a "refresh link" control in the same place when it expires; a request that reuses an existing job says so in place instead of appearing to do nothing.
