# Check a provider integration

Use this checklist when adding or changing a [provider adapter](PROVIDERS.md).
Run protocol tests locally, then test the connection with an authorized account.

## Local protocol checks

- Validate structured output and reject malformed or oversized results.
- Exercise cancellation, timeouts and recovery.
- Check that credentials are filtered from output and saved records.
- Confirm required capabilities and permission modes are handled correctly.

Use isolated projects and fixture adapters for these checks. See the
[test guide](VALIDATION.md) for repository commands.

## Live connection checks

Agree on the account, permitted billing, usage budget and acceptance criteria
before starting a live run. Then use a disposable project to check:

1. Authentication and model selection.
2. Research source discovery and a report with supporting quotes.
3. Plan and Design approval pauses.
4. A small Build task, its checks and Git checkpoint.
5. Cancellation and recovery from an interrupted task.
6. Test review and the final local Ship summary.

Record the provider and CLI versions, operating system, commands, results and
failures. Keep live results separate from fixture results so contributors can
reproduce each test. Follow the [security guide](../SECURITY.md) when granting
providers access to files or commands.
