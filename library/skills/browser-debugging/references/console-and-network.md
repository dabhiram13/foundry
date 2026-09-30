# Console And Network

Use this when the bug smells like runtime, auth, or data.

Check:
- console errors
- failing requests
- status codes
- response payload shape
- auth/session headers or cookies when relevant
- duplicate or missing requests

Common outcomes:
- bad route or redirect
- auth state mismatch
- missing env / config
- incorrect payload contract
- client-side rendering or hydration issue
