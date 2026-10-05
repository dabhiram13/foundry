# Historical record: Small journeys with observable evidence

> Product browser testing remains relevant to products being built, not to the Foundry framework.

Use the relevant rows when defining a vertical slice. Keep a single form for a
simple task; add a review or navigation step only when it helps a real decision.
Attach observations to the product's own browser journey, not this fixture's pass.

| Question | Observable acceptance | Disposable fixture evidence |
|---|---|---|
| Can someone correct and return? | Back/edit preserves input; reload resumes the same session's draft; another account cannot see it | `GUIDED-EDIT-RESUME`, `TENANT-UI` |
| Can they enter valid information? | Persistent label and help; invalid input cannot commit; focus returns to the correction | `GUIDED-EDIT-RESUME`, HTTP malformed-input tests |
| Is waiting understandable? | Announced pending state; pending action disabled; completion visible | `UX-LOADING-KEYBOARD`, `PROVIDER-FAILURE`, `SAVE-RETRY` |
| Can they recover safely? | Actionable error receives focus; retry preserves committed operation identity and balance | `REFRESH-RETRY-SESSION`, `REFRESH-RETRY-LIST` |
| Can they use keyboard and mobile? | Logical focus after navigation/error/result; labelled inputs, visible focus and no narrow-viewport clipping | `MOBILE-A11Y`, `AUTH-EMPTY` |
| Did first value actually occur? | First successfully committed outline emits one account-scoped activation; failures emit none; retries/restart do not duplicate | `ACTIVATION-ONCE`, HTTP activation regression |

The activation event is `first_outline_saved`. Its SQLite row holds only an
internal account identifier and event name, committed with the outline and debit.
The authenticated endpoint returns only the current account's event name/count.
No email, title, external analytics, or marketing service receives event data.
Drafts use tab session storage and are cleared on signout; they are disposable,
not a cross-device draft service. No real customer data belongs in this fixture.

These checks establish particular behavior, not full WCAG conformance, native
agent delivery, customer demand or actual activation by customers. Synthetic
feedback remains synthetic. A product must choose its own first-value event and
validate it against the customer's job.

## Inspiration and attribution

Original rubric and implementation; no upstream code or skill text was copied.
Reviewed the MIT-licensed [Dembrandt skills at pinned revision
`e74648d95d415ce5ce9b2217de0aa5faf4b383f4`](https://github.com/dembrandt/dembrandt-skills/tree/e74648d95d415ce5ce9b2217de0aa5faf4b383f4/skills):
`user-flows-and-guided-paths`, `form-design`,
`loading-states-and-perceived-performance`, `notifications-and-recovery`, and
`wcag-accessibility`. Their Markdown structure checks do not execute this product
or prove behavior. No Dembrandt dependency or orchestration layer was installed.
