# Quality Checklist

Run before archiving any feature. ALL items must pass.

## Build
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npx eslint .` — zero errors

## Tests
- [ ] `npx vitest run` — all tests pass
- [ ] `npx playwright test tests/e2e/{feature}.spec.ts` — all E2E tests pass
- [ ] Coverage >90% for feature files

## Architecture
- [ ] No circular imports (check with `npx madge --circular webapp/features/{feature}/`)
- [ ] Feature components only import from: `@/components/ui/`, `@/features/_shared/`, `@/lib/`
- [ ] Procedures only import from: `../base`, `../schemas`, `../errors`, external libs
- [ ] No direct Supabase calls from components (all via ORPC)

## Code Quality
- [ ] No `any` types in feature code
- [ ] No `eslint-disable` comments (except documented exceptions)
- [ ] No `console.log` in production code (use structured logging)
- [ ] All components have loading, error, and empty states
- [ ] Forms validate on server (Zod schemas), not client

## Security
- [ ] All inputs validated with secure schemas (secureObject)
- [ ] RLS policies exist for new tables
- [ ] No secrets in client-side code
- [ ] No SQL injection vectors (using Supabase client, not raw SQL)

## Documentation
- [ ] `dev/active/{feature}/decisions.md` has all non-obvious choices
- [ ] `dev/active/{feature}/tasks.md` has all items checked
- [ ] File paths in feature docs match reality
