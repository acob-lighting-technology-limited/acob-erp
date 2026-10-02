## What and why

<!-- One or two sentences: the change and the problem it solves. Link the issue or audit item. -->

## How to verify

<!-- Steps a reviewer can follow, and what they should see. -->

## Checklist

- [ ] `npx tsc --noEmit` and `npm run lint:strict` pass
- [ ] `npm test` passes (and new logic has a test)
- [ ] No browser code writes to Supabase directly — writes go through an `/api/` route with zod validation
- [ ] New tables enable RLS in the same migration; new `SECURITY DEFINER` functions revoke `EXECUTE` from `PUBLIC, anon`
- [ ] Migrations listed below, with whether they are applied (`npx supabase migration list`)
- [ ] Reused existing components/helpers instead of copying (see AGENTS.md → Engineering Practices)

## Migrations

<!-- None, or: 20261002100000_example.sql — not applied / applied -->
