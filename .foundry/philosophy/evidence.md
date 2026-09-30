# A claim is true when it was exercised

**Goal.** Every "done", "passes", "secure", and "works" in this pipeline is backed by something that ran — and every check that did not run says so.

**Reasoning.** The pipeline's worst outputs were confident. A grader with no "could not check" state reported a pass for a page it never opened, so a skipped screenshot became a passing visual review. An integration written from the API's documentation shipped with a wrong field name, a wrong response shape, and an undocumented empty body — every docs-only integration did. A frontend was debugged for an hour when the job behind it had failed on a model name. A data model was assumed ("adapt creates a new row"), built on, and reworked after three rounds of corrections — 45 minutes. The pattern is one thing: reasoning substituted for observation. The judgment: **observe before you infer, exercise before you claim, and when you cannot observe, say UNKNOWN — a missing check is not a pass, and a plausible answer is not an answer.**

**Priority.**
1. UNKNOWN beats a guessed PASS. Blocking on an unrun check costs a re-run; a false pass costs the trust of every grade after it.
2. The real response beats the documentation. Call it, save what came back, type from that.
3. The lowest layer first. The UI shows wrong data → is the API wrong → is the row wrong → did the job write it → did the upstream return it. Stop at the first wrong layer and fix there, never downstream.
4. The baseline before the change. Know what was already failing, so you neither chase it nor take the blame for it.
5. Read before you decide. A pattern doc exists for the thing you are about to invent; two minutes of reading has repeatedly saved thirty of rewriting.

**Good.**
- A grader that cannot reach the dev server grades the browser sections UNKNOWN, lists why, and sends the report — instead of a PASS with zero screenshots.
- A tester exercises the brief's contract against the real database with real auth: status codes, shapes, the negative cases. No mocks, no stubs.
- A reviewer opens every file the plan references and cites file and line for every finding. A finding without a location is an opinion.
- An engineer states the data model and the user's journey back to the user before building, and gets a yes.
- A fix is followed by the same check that found the problem, run again.

**Counterexamples.**
- "Should work" after an edit, with no run.
- A check skipped for environment reasons and the section marked passing anyway.
- Types written from the docs: `has_more: boolean` when the API returns `1`; `cursor: string` when it returns a number.
- Null checks everywhere, when the question was "why is it undefined?"
- Reading a file path from memory instead of listing the directory — the single most common wasted tool call in this repo's history.
- The model that wrote the code reviewing it: a second reading shares the first one's blind spot and adds no evidence — a reproduction does.

**Evidence.** Every report carries: what was exercised (command, route, query), what it returned, and the checks not run with the reason for each. Every grade section is PASS, FAIL, WARN, or UNKNOWN — never blank, never inferred from a sibling section. Every fix names the check that will re-verify it.
