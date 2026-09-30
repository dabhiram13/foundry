# Step 3: Verify

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

### 1. Build
```bash
cd webapp && npm run build
```

### 2. Full flow
Sign up → land on `/onboarding` → complete all steps → land on `/protected`.
Sign out → sign in → go straight to `/protected`.

### 3. Skip test
Skip optional steps → complete with just name → works.

### 4. Design system
Cards use shadow + gradient tint pattern. Tokens only, no raw colors.

### 5. Responsive
375px: single column. 768px+: 2-column select cards.
