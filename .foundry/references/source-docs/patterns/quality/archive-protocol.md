# Archive Protocol

Steps to move a completed feature from active to archive.

## Pre-conditions
- ALL quality checklist items pass
- ALL tasks in `dev/active/{feature}/tasks.md` are checked `[x]`
- No blockers in `dev/active/{feature}/context.md`

## Steps

### 1. Final Context Update
Update `dev/active/{feature}/context.md`:
```markdown
## Status
- **Phase**: COMPLETE
- **Completed**: {date}

## Final Files
### Backend
- webapp/lib/orpc/procedures/{feature}.ts
- webapp/lib/orpc/procedures/protected.ts (modified — added router entry)

### Frontend
- webapp/features/{feature}/components/*.tsx
- webapp/features/{feature}/hooks/*.ts
- webapp/features/{feature}/types/index.ts
- webapp/app/protected/{feature}/page.tsx

### Tests
- webapp/lib/orpc/procedures/{feature}.test.ts
- webapp/tests/e2e/{feature}.spec.ts
- webapp/tests/e2e/pages/{Feature}Page.ts

## Quality Results
- Type check: PASS
- Lint: PASS
- Coverage: {X}%
- E2E: {X}/{X} tests pass
```

### 2. Move Directory
```bash
mv dev/active/{feature}/ dev/archive/{feature}/
```

### 3. Verify
- [ ] `dev/active/{feature}/` no longer exists
- [ ] `dev/archive/{feature}/` contains plan.md, tasks.md, context.md, decisions.md
- [ ] No broken references in other active features
