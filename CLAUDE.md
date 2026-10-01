# Claude Code Rules — ACOB Platform

All engineering standards and UI patterns for this codebase are defined in
**`AGENTS.md`** at the project root. That file is the single source of truth
shared across all AI agents (Claude, Codex, Cursor, etc.). If this file and
`AGENTS.md` ever disagree, fix the disagreement — do not pick one silently.

Read `AGENTS.md` fully before starting any task. Every rule there is mandatory.
The sections that matter most day to day:

> **Engineering Practices** — reuse before you write, one component per screen
> across staff/admin/dept, all writes server-side, zod on every route, fix the
> cause not the symptom.
>
> **Database Security Standard** — RLS, column grants, `SECURITY DEFINER`
> lockdown. The 2026-10 audit found live holes in exactly these areas.
>
> **Table Page Standard** — every list/data page uses `DataTablePage` +
> `DataTable` from `@/components/ui/data-table`.

Known problems and their planned fixes are in
`docs/audit/2026-10-01-full-repo-critique.md`. When you touch code the audit
names, fix it the way the audit describes rather than extending the problem.

## Never run `npm run build`

Do **not** run `npm run build` to check your work. It takes ~3 minutes, and the
dev server is usually running — the build competes with it for `.next/` and
disrupts what the user is doing.

The pre-push hook (`.husky/pre-push`) runs `lint:strict` and `type-check` only —
**not** `build` (removed in `2c38430b`). Nothing builds locally or in CI; Vercel
is the only place `next build` runs. Do not claim a push will build the project.

To verify a change, use the fast checks:

```bash
npx tsc --noEmit -p tsconfig.json     # types
npx eslint <changed files>            # lint
npm run test:admin-scope              # or the relevant test script
```

The only exception is debugging a failure that *only* reproduces in a
production build — and then say why before running it.

## Commit when the work is tangible

Commit a complete, verified unit — a fix, a feature slice, a refactor, with its
migration — once the fast checks pass. Not before (no WIP or half-done commits),
and do not hand back to the user with a finished unit left uncommitted. Group
commits by feature as described in `AGENTS.md`, stage only your own paths, and
never add a `Co-Authored-By` trailer.

## Production changes need an explicit yes

There is no staging database. Before pushing a migration, running a write
against the live Supabase project, or changing any external account or service,
show the user exactly what will change and wait for an explicit confirmation.
