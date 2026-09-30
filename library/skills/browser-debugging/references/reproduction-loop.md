# Reproduction Loop

Default loop:

1. define the exact failing behavior
2. reproduce it in the browser using the same route, data, viewport, and auth state
3. wait for and capture the specific user-visible state; for test failures, inspect the trace
4. isolate whether it is:
   - UI state
   - data / network
   - auth / session
   - route / navigation
   - test expectation or locator
   - environment, data, or flaky timing
5. choose the next fix surface
6. after the fix, repeat the original flow; for a flake, run it repeatedly with CI-like workers

Output should stay short:
- failing page/flow
- exact symptom
- evidence captured
- likely layer
- next file(s) or skill(s)
