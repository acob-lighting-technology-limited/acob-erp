# Claude Code — Project Instructions for acob-erp

## ⛔ CRITICAL RULES — READ FIRST, NEVER VIOLATE

### No worktrees — ever
- **NEVER** create a git worktree (`git worktree add`, `EnterWorktree`, or any equivalent).
- **NEVER** run `git checkout -b` to create a new branch mid-session.
- All work happens on the **existing checked-out branch** in `/Users/chibuike/Documents/GitHub/clone/ERP`.
- The forbidden worktree path is `.claude/worktrees/` — do not touch it.

### No `--no-verify`
- **NEVER** use `git commit --no-verify` or `git push --no-verify`.
- All commits must pass the husky pre-commit hook (lint-staged → ESLint + Prettier).
- All pushes must pass the husky pre-push hook (`npm run build`).
- If a hook fails, **fix the underlying issue** — do not bypass the hook.

### Commit message format (commitlint enforced)
- Format: `type: description` — single line, all lowercase subject.
- Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, `revert`.
- Max 72 chars total. No trailing period. No uppercase in the subject.
- ✅ `fix: resolve build error` ❌ `fix: Resolve Build Error` ❌ `security: do xyz`

### Always run `npx next build` before pushing
- Confirm the build passes locally before `git push`.

---

## Project context

- **Stack**: Next.js 14 (App Router), Supabase (PostgreSQL 17), TypeScript, Tailwind CSS, shadcn/ui
- **Branch**: `codex/all-uncommitted-changes-20260309`
- **Supabase project ID**: `itqegqxeqkeogwrvlzlj`
- **Audit logging**: use `writeAuditLog()` from `@/lib/audit/write-audit` with `failOpen: true` for non-blocking logs
- **Structured logger**: use `logger("module-name")` from `@/lib/logger` — never use `console.log`
- **No `window.prompt` / `window.confirm` / `window.alert`**: use `<PromptDialog>` or `<AlertDialog>` from shadcn/ui instead
- **No `Math.random()`** for anything security-related — use `crypto.randomUUID()` or `crypto.getRandomValues()`

## API versioning policy

Unversioned routes (`/api/`) are the canonical routes used by the frontend. `/api/v1/` routes are legacy duplicates created during an earlier refactor. They are kept for backward compatibility but should not have new features added. New routes go into `/api/` (unversioned). The `/api/v1/` routes will be removed once all callers have been migrated to their `/api/` equivalents.

Current v1 routes and their unversioned equivalents:
- `/api/v1/hr/attendance/clock-in` → use `/api/hr/attendance/clock-in` (TBD)
- `/api/v1/hr/attendance/clock-out` → use `/api/hr/attendance/clock-out` (TBD)
- `/api/v1/hr/performance/goals` → use `/api/hr/performance/goals`
- `/api/v1/hr/performance/reviews` → use `/api/hr/performance/reviews` (TBD)
- `/api/v1/hr/departments` → use `/api/departments`
- `/api/v1/finance/payments` → use `/api/payments`
- `/api/v1/hr/employees/[id]/status` → use `/api/v1/hr/employees/[id]/status` (no equivalent yet)
