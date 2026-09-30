# Reproduction Loop

Default loop:

1. define the exact failing behavior
2. reproduce it in the browser
3. capture what is visible
4. isolate whether it is:
   - UI state
   - data / network
   - auth / session
   - route / navigation
   - flaky test only
5. choose the next fix surface

Output should stay short:
- failing page/flow
- exact symptom
- evidence captured
- likely layer
- next file(s) or skill(s)
