# Repository Agent Standards

This file defines the minimum engineering standards that AI agents must follow when working in this repository. These rules are intended to prevent lint debt, weak typing, build regressions, and workflow bypasses.

## Delivery Standard

Do not treat a task as complete until all required checks pass:

- `npx eslint . --ext .ts,.tsx`
- `npx tsc --noEmit`
<!-- - `npm run build` -->

If a change cannot satisfy all three checks, report the blocker clearly instead of claiming completion.

## Git and Hook Policy

- Never use `git commit --no-verify`.
- Never use `git push --no-verify`.
- Do not bypass failing hooks. Fix the underlying issue.
- Pre-commit must pass `lint-staged` including ESLint and Prettier.
- Pre-push must pass `npm run build`.
- Confirm the build passes locally before pushing.

## Commit Message Standard

- Format commits as `type: description`.
- Use a single-line, lowercase subject.
- Keep the full message to 72 characters or fewer.
- Do not end the subject with a period.
- Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, `revert`.

Examples:

- Good: `fix: resolve build error`
- Bad: `fix: Resolve Build Error`
- Bad: `security: do xyz`

## TypeScript and Linting Policy

- Do not add `@ts-nocheck`.
- Do not add `@ts-ignore` unless there is no practical alternative and the reason is documented inline.
- Do not disable lint rules to avoid fixing the real problem.
- Do not introduce `any` unless there is no practical alternative.
- Prefer `unknown`, narrow interfaces, discriminated unions, typed helper results, or explicit DTOs.
- If `any` is used temporarily during a refactor, remove it before finishing the task.

## Supabase Typing Standard

- Do not assume every real table or column exists in `@/types/database`.
- If generated Supabase types are incomplete or stale, define a narrow local type for the selected row shape.
- Do not force broken references like `Database["public"]["Tables"][...]` when the table is not represented correctly.
- When working with joins, type the selected result shape explicitly instead of relying on deep inference.
- Prefer local row types over broad casts.

## Query Construction Rules

Be cautious with helper wrappers around Supabase queries in build-sensitive code.

- Helper chains such as `applyAssignableStatusFilter(...)` can trigger `Type instantiation is excessively deep and possibly infinite` during `next build`.
- In server components, route handlers, diagnostics, and admin pages, prefer:
- direct `supabase.from(...).select(...)` queries
- explicit local row types
- manual filtering with `isAssignableEmploymentStatus(...)` when needed
- If a helper begins causing deep generic inference failures, replace it with a direct query and explicit post-filtering.

## Nullability Discipline

- Do not pass `string | null | undefined` to code that requires `string`.
- Normalize nullable values before use.
- Guard required values early.
- When writing type predicates, make sure the narrowed type is assignable to the source type.

Preferred patterns:

- `const role = profile.role || ""`
- `const stageCode = item.current_stage_code || item.approval_stage || ""`
- `if (!value) return NextResponse.json(...)`

## React Compatibility

- Do not use `useEffectEvent` unless the installed React version in this repository supports it.
- Do not resolve hook dependency warnings mechanically if doing so changes runtime behavior.
- Prefer stable helpers, refactors, or clearer state flow over unsafe dependency-array edits.

## Logging and Audit Expectations

- Use `logger("module-name")` from `@/lib/logger` instead of `console.log`.
- Use `writeAuditLog()` from `@/lib/audit/write-audit` with `failOpen: true` for non-blocking audit logging where applicable.

## API Versioning

- Canonical API routes belong under `/api/`.
- Do not add new features to `/api/v1/` unless the task is explicitly about backward compatibility or legacy maintenance.
