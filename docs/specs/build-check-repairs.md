# Build check repairs

Build task checks use the same runner as lifecycle checks. Report producers get
an execution ID and report path; passing requires fresh, consistent, nonzero
counts without failures or skips. A missing executable produces a saved
`unavailable` result and enters the existing three-attempt repair loop.

Cancellation stops the process group, preserves interrupted status, and allows
retry without restarting the server. Check execution must not advance lifecycle
state. Regression coverage lives in `tests/test_factory.py`; all configured
framework checks must pass.
