# Step 2: Adapt the Skeleton

> **Repository compatibility:** Read `AGENTS.md`, the active runtime spec, and any owner-named product documents first. Inspect the real stack before applying this recipe. Paths, services, and SaaS conventions below are conditional examples: use them only when present and in scope, and map them to the repository's equivalent otherwise. Files under `docs/project/` and `docs/built/` are optional context unless the owner or active spec requires them. Never create a missing proprietary skeleton merely to satisfy this workflow.

Change the existing code to match this project's decisions from Step 1.

## Actions

### 1. Database — update preference columns

If the skeleton's preference columns don't match:

```sql
-- Drop columns that don't apply
ALTER TABLE profiles DROP COLUMN IF EXISTS preference_team_size;

-- Add/rename columns for this project
ALTER TABLE profiles ADD COLUMN preference_{name} text
  CHECK (preference_{name} IN ('opt1', 'opt2', 'opt3'));
```

Read `db-schema.md` to check current state. Don't duplicate.

### 2. ORPC — update `savePreferences` schema

In `webapp/lib/orpc/procedures/onboarding.ts`, update the Zod schema for `savePreferences` to match the new preference columns:

```typescript
secureObject({
  preference_{name}: z.enum(['opt1', 'opt2', 'opt3']),
  // ... match what's in the DB
})
```

### 3. Frontend — update step components

In `webapp/features/onboarding/components/`:

- **Remove** step components for cut questions
- **Update** option labels/descriptions/icons in kept step components
- **Update** constants (TOTAL_STEPS, option arrays)
- **Update** flow orchestrator step sequence

### 4. Copy — make it feel right

Update headings, subtext, and welcome messaging to match this product:
- Replace generic "What describes you best?" with project-specific questions
- Subtext should reference the product's value prop ("We'll customize your {product feature}")

### 5. Auth redirect — verify

Confirm sign-in procedure returns `redirectTo: '/onboarding'` when `onboarding_completed` is false. This should already work from the auth skeleton.

## Output

Adapted onboarding flow with this project's questions, options, and copy.
