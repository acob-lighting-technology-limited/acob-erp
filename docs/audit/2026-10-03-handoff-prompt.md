# Handoff prompt — open items from the 2026-10 audit

Paste everything below the line into the coding agent (ChatGPT/Codex) with this
repo checked out on `chore/audit-remediation`. It covers every **open** code item
that needs no external account and no Supabase change. Claude will review the
result phase by phase against the "Done means" lists.

Out of scope on purpose (do not let the agent start these):
§4 Supabase / generated types / staging / RLS tests (owner deferred), Sentry,
Entra SSO, a job queue (all need accounts), A8–A10, 13.7 branch split.

---

You are working in a Next.js 16 / React 19 / Tailwind v4 / shadcn / TanStack
Query / zod / Supabase app (the "Matrix" staff platform). The branch is
`chore/audit-remediation`. Before anything else read, in full:

1. `AGENTS.md` — every rule there is mandatory.
2. `CLAUDE.md`.
3. `docs/audit/2026-10-01-full-repo-critique.md` — the audit. Each row has a
   checkbox; the items you are doing are listed below with their row numbers.

## Hard rules (breaking any of these fails the review)

- **Never run `npm run build`.** Verify with:
  `npx tsc --noEmit -p tsconfig.json`, `npx eslint <changed files>`,
  `npm run lint:strict` (zero warnings allowed), and `npm test`.
- **Do not push**, do not open PRs, do not touch Supabase, do not write or apply
  migrations. If something needs a DB change, stop and write it in your report.
- **Do not touch these files** (another person's uncommitted work):
  `app/(app)/accounts/payroll/view.tsx`, `app/admin/payroll/[id]/view.tsx`,
  `app/admin/hr/lunch/view.tsx`, `lunch-menu-builder-dialog.tsx`,
  `lunch-share-dialog.tsx`, `lib/hr/payslip-*`, `app/birthday*`, `docs/scorecard/`.
- Commit after each finished unit, staging **only your own paths** (never
  `git add -A` / `git add .`). Message format `type: lowercase summary`,
  ≤ 72 chars, conventional types (`feat`, `fix`, `refactor`, `style`, `perf`,
  `chore`, `docs`, `test`). **No `Co-Authored-By` trailer.** Never `--no-verify`;
  if the pre-commit hook fails, fix the cause.
- No WIP commits. Every commit must pass tsc + eslint on its files.
- Do not change behaviour you were not asked to change. Same permissions, same
  scopes (staff / dept-lead / admin), same API response shapes unless a phase
  says otherwise.
- Reuse what exists before writing anything new: `lib/format` (dates, naira,
  names), `lib/status-tones` + `StatusBadge`, `lib/api-client` (`apiJson`),
  `lib/query-keys` (`QUERY_KEYS`), `lib/api/parse-body` (`parseJsonBody`),
  `lib/api/errors` (`serverError`, `validationError`, `apiError`),
  `lib/logger`, `components/ui/data-table`, `components/skeletons/*`,
  the confirm-dialog provider. Never `console.*` (lint error). Never
  fetch inside `useEffect` (lint error) — use React Query.
- Colours: tokens only (`bg-success-muted text-success-foreground`, etc.). No
  new `bg-green-100`-style classes. Text no smaller than 12px (`text-xs`).
- Keep each file under ~600 lines. If a file you touch is bigger, split it.

## Work in this order. Finish and commit a phase before starting the next.

### Phase 1 — Table-native export (audit 7.9, `toCsv` row in §9c)

Goal: any `DataTable` can export what the user sees, so per-page export code
goes away.

1. Add an `export` prop to `DataTable` / `DataTablePage`:
   `export?: { filename: string; formats?: Array<"csv" | "xlsx" | "pdf">; title?: string } | false`.
   Default: off (opt-in, so nothing changes for pages that don't ask).
2. Export = **visible columns × filtered + sorted rows** (all pages, not just
   the current page). Cell value = `column.accessor(row)`; columns without an
   `accessor` are skipped. Header = `column.label`.
3. Put the writers in `lib/export/table-export.ts` and build them on the
   existing `lib/export/*` modules (xlsx via `@e965/xlsx`, PDF via
   `jspdf` + `jspdf-autotable`, already used there). Lazy-`import()` the xlsx
   and pdf libraries inside the click handler so they never enter the page
   bundle.
4. CSV: RFC 4180 quoting, UTF-8 BOM so Excel opens naira signs correctly,
   and prefix cells starting with `= + - @` with `'` (CSV-injection guard).
5. One `toCsv` in `lib/export/csv.ts`; replace the 4 local `toCsv` copies
   (grep `function toCsv`/`const toCsv`) with it.
6. Add a unit test `lib/export/__tests__/csv.test.ts` (quoting, BOM,
   injection guard, null → empty) and wire it into `package.json` `test`.
7. Migrate `AssetExportDialog` and `EmployeeExportDialog` (88% identical) to
   the table export where the exported columns match the table; if they
   export extra columns the table doesn't show, keep the dialog but make it
   call `lib/export/table-export.ts` with an explicit column list — one code
   path either way. Delete whatever becomes unused.

Done means: export button appears only where `export` is set; CSV test passes;
no remaining local `toCsv`; the two dialogs share one implementation.

### Phase 2 — `list-toolbar` for card/grid pages (§9c row)

1. Create `components/ui/patterns/list-toolbar.tsx`: search input (debounced
   250 ms), optional filter selects (same `DataTableFilter` shape DataTable
   uses), optional view toggle, result count. URL-synced the same way
   DataTable's `urlSync` does it — reuse that code, don't fork it.
2. Find card/grid pages that hand-roll a search + filter bar (grep for
   `placeholder="Search` outside `components/ui/data-table`). Move each to
   `ListToolbar`. Delete the old bars.

Done means: no hand-rolled search bar outside DataTable/ListToolbar; filters
survive a reload via the URL.

### Phase 3 — Skeleton derived from page config (audit 8.2, 11.9)

Problem: `TablePageSkeleton` (`components/skeletons/table-page-skeleton.tsx`)
takes ~12 props that each `loading.tsx` must keep in sync with its page's
`DataTablePage` props by hand (165 files use it).

1. Define `type TablePageLayout = { tabs?: number; statCards?: number; statBadges?: number; filters?: number; columns?: number; actions?: number; showBackLink?: boolean; spacing?: "standard" | "tight"; inlineActions?: boolean; list?: "table" | "contacts" | "responsive"; groups?: number }`
   in `components/ui/data-table/types.ts`.
2. For each page using `DataTablePage`, create a colocated
   `_layout.ts` (or export from an existing `_lib`) holding
   `export const layout: TablePageLayout = {...}` with values **read from the
   page's actual props** (count its tabs, stats, filters, visible columns).
3. `DataTablePage` accepts `layout` and asserts in development
   (`process.env.NODE_ENV !== "production"`) that its real tab/stat/filter
   counts match, logging through `lib/logger` (`warn`) when they drift.
4. `loading.tsx` becomes `<TablePageSkeleton {...layout} />` importing the
   same object.
5. Do it in batches by area (hr, reports, accounts, …), one commit per area.

Done means: no `loading.tsx` passes literal layout numbers to
`TablePageSkeleton`; every one imports its page's `layout`.

### Phase 4 — DataTable on TanStack Table (audit 7.1, 7.3)

`components/ui/data-table/data-table.tsx` is ~2,000 lines and owns sorting,
filtering, pagination, column order/visibility/resizing, selection, mobile
grouping, the detail sheet, skeleton and empty state.

1. `npm i @tanstack/react-table @tanstack/react-virtual`.
2. **The public API in `components/ui/data-table/types.ts` must not change**
   (`DataTableColumn`, `DataTableFilter`, `PaginationConfig`, view modes,
   `detail`, `emptyAction`, `urlSync`, `serverSide`, `totalRows`,
   `onPageChange`, the auto-pagination at 50 rows once data > 200). The 100+
   pages must compile and behave the same without edits.
3. Internally: map `DataTableColumn` → TanStack `ColumnDef` (accessorFn from
   `accessor`, `enableSorting` from `sortable`, size from `initialWidth`),
   and use TanStack's sorting / filtering / pagination / row selection /
   column visibility / column order / column sizing state. Keep the existing
   URL-sync by reading/writing that state.
4. Split into files under `components/ui/data-table/`: `use-data-table.ts`
   (TanStack instance + URL sync), `table-view.tsx`, `card-view.tsx`,
   `contacts-view.tsx` (mobile grouped list), `toolbar.tsx`,
   `pagination.tsx`, `detail-sheet.tsx`. Each ≤ 400 lines.
5. Virtualise the grouped contacts/mobile list with `@tanstack/react-virtual`
   when rows > 200 (audit 7.3).
6. Tests: `components/ui/data-table/__tests__/use-data-table.test.ts` covering
   sort, filter, pagination, URL round-trip, and auto-pagination >200.

Done means: `data-table.tsx` is a thin composition file; no page changed;
tests pass; `lint:strict` clean.

### Phase 5 — Server pagination for big tables (audit 7.2)

Only after Phase 4. Tables that can exceed ~500 rows: audit logs (~19.6k),
notifications, attendance events, customers (~2.2k), correspondence. Check
row counts by reading the code paths, not the DB.

1. Each API route accepts `?page&pageSize&sort&dir&q&<filters>` validated with
   zod (`pageSize` max 100), applies `.range()`, `.order()`, filters and
   `count: "exact"` (or `"estimated"` above 10k rows), and returns
   `{ data, total }`. Select explicit columns, never `*`.
2. Keep the old response shape for other callers: only switch when the
   `page` param is present.
3. Pages pass `pagination={{ pageSize, serverSide: true }}`, `totalRows`,
   and drive the query key from the URL state
   (`QUERY_KEYS.x({ page, sort, q, ... })`) with
   `placeholderData: keepPreviousData`.
4. Follow the two existing examples: `app/admin/pms/reviews/view.tsx` and
   `app/admin/correspondence/admin-reference-generator-content.tsx`.

Done means: those tables never download more than one page; search and sort
still work; export (Phase 1) on a server table fetches all matching rows via
the same endpoint with `pageSize` looped, capped at 10k with a toast if hit.

### Phase 6 — Forms on react-hook-form + zod (audit 2.5)

~147 files hand-roll `useState` forms; ~10 already use RHF
(`components/profile-form.tsx`, `components/feedback-form.tsx`,
`components/assets/*Dialog.tsx`, `components/payments/*-dialog.tsx`,
`components/hr/manage-users-dialog.tsx`, `app/employee/new/page.tsx`).

1. Add shadcn's `components/ui/form.tsx` (`Form`, `FormField`, `FormItem`,
   `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`).
2. Shared schemas: for each form, the zod schema lives in
   `lib/<domain>/schemas.ts` and is imported by **both** the form
   (`zodResolver(schema)`) and the API route (`parseJsonBody(req, schema)`).
   If the route currently has its own schema, move it, don't duplicate it.
3. Standard behaviour every form must have: field errors under the field;
   submit button disabled + spinner while `isSubmitting`; server errors
   (`{ error, details }` from `lib/api/errors`) mapped back onto fields with
   `setError` when `details` has paths, otherwise a toast; values kept after
   a failed submit; Enter submits; dialog forms reset when reopened
   (mount the form only while the dialog is open — do **not** call
   `reset()` during render).
4. Submit with `useMutation` + `apiJson`, invalidate the relevant
   `QUERY_KEYS`.
5. Order: highest-traffic first — leave request, task create/edit, weekly
   report, action tracker item, help-desk ticket, requisition, lunch vote
   dialogs, profile/employee edit, then the rest by area. One commit per
   form or per small related group.

Done means: grep `useState` for form field state in dialogs returns nothing
for converted areas; every converted route uses the shared schema; list of
converted vs remaining files in the report.

### Phase 7 — Server Components + streaming (audit 6.8, 8.7, §12 rendering)

Do this last and only for pages where it is clean.

1. Pick read-mostly pages first (profile, directory, notifications page,
   dashboards). In `page.tsx` (server), fetch with the server Supabase client
   (RLS applies), then render a small client component with the data as
   props. Push `"use client"` down to the interactive leaf.
2. Where React Query is still needed on the client, prefetch on the server
   with `HydrationBoundary` + `dehydrate` using the **same** `QUERY_KEYS`, so
   there is no double fetch.
3. Wrap slow sections in `<Suspense fallback={<SameSizeSkeleton />}>` so the
   shell renders immediately.
4. Do not change auth/scope logic. Do not add `"use cache"` to anything that
   reads per-user data.

Done means: each converted page has no client-side initial fetch for its main
data; listed in the report with before/after `"use client"` count.

### Optional Phase 8 — React Email (§10)

Only if phases 1–7 are done. Move `lib/email-templates/*.ts` HTML strings to
`@react-email/components` components rendered with `render()` in the same
send functions. Output HTML must stay Outlook-safe (tables, inline styles).
Keep every send function's signature.

## Report back (required)

When you stop, write `docs/audit/2026-10-handoff-report.md` with, per phase:
- commits (hash + message),
- files created / deleted,
- what you did NOT do and why,
- anything that needs a DB change or a decision,
- the exact output tail of `npx tsc --noEmit`, `npm run lint:strict`,
  `npm test`.

Also tick the audit rows you finished in
`docs/audit/2026-10-01-full-repo-critique.md` (`[ ]` → `[x]` or `[~]` with a
short note and commit hash), in the same style as the rows already ticked.
