# Claude Code Rules — ACOB Platform

All engineering standards and UI patterns for this codebase are defined in
**`AGENTS.md`** at the project root. That file is the single source of truth
shared across all AI agents (Claude, Codex, Cursor, etc.).

Read `AGENTS.md` fully before starting any task. Every rule there is mandatory.

The most critical section for day-to-day work is:

> **Table Page Standard** — every list/data page must use `DataTablePage` +
> `DataTable` from `@/components/ui/data-table`. See `AGENTS.md` for the
> full layout order, feature checklist, column/filter API, and hard prohibitions.
