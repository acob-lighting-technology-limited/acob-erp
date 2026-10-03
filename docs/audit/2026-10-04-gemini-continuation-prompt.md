# Continuation prompt — for Gemini

Paste everything below the line into Gemini (CLI / Code Assist) with this repo
checked out on `chore/audit-remediation`. ChatGPT started the handoff in
`docs/audit/2026-10-03-handoff-prompt.md` and stopped part-way through Phase 2.
Claude reviewed its work on 2026-10-04; the findings are in step 1 below.

---

You are continuing work another agent started. Before anything else, read in
full:

1. `AGENTS.md` and `CLAUDE.md` — every rule is mandatory.
2. `docs/audit/2026-10-03-handoff-prompt.md` — **the task specification.** Its
   "Hard rules" section applies to you word for word (never `npm run build`,
   never push, no Supabase / migrations, don't touch the listed files of
   another session, commit per finished unit staging only your own paths,
   `type: lowercase` messages ≤ 72 chars, **no Co-Authored-By trailer**, never
   `--no-verify`). Its phases and "Done means" lists are what you will be
   checked against.
3. `docs/audit/2026-10-handoff-report.md` — what the previous agent reported.
4. `docs/audit/2026-10-01-full-repo-critique.md` — the audit checklist.

## Where things stand

**Phase 1 (table-native export) — committed** in `5ed763f2` and `dcc9b473`:
`lib/export/csv.ts` (`toCsv`), `lib/export/table-export.ts` (`exportTable`,
lazy-loads xlsx/jspdf), `components/ui/data-table/export-button.tsx`, the
`export` prop on `DataTable`/`DataTablePage`, a CSV test
(`npm run test:export`, 4 passing), employee/asset/directory exports moved to
the shared writer. It also split `data-table.tsx` (≈2,000 → 262 lines) into
`use-data-table-state.tsx`, `toolbar.tsx`, `table-view.tsx`,
`contacts-view.tsx`, `detail-sheet.tsx`, `status-bar.tsx`,
`legacy-primitives.tsx`, `use-mobile-list.ts`, `detail-config.ts`,
`export-context.tsx`. That split is groundwork for Phase 4, not Phase 4 itself
(no TanStack yet).

**Phase 2 (ListToolbar) — started, NOT committed, currently broken.**
Uncommitted changes in two files only:
- `components/ui/patterns/list-toolbar.tsx` — added `resultCount` /
  `resultLabel` props and a `useDebouncedListSearch` hook.
- `components/documentation/department-documents-browser.tsx` — moved its
  search/filter bar onto `ListToolbar` and URL-synced `q`, `type`, `sort`,
  `view`.

## Step 1 — fix these before continuing (in this order)

1. **Type/lint error, blocks every commit:**
   `components/documentation/department-documents-browser.tsx:1582` passes
   `actions=` twice to the same `ListToolbar` (TS17001,
   `react/jsx-no-duplicate-props`). Merge the two into one `actions` node.
2. **CSV corrupts negative numbers.** In `lib/export/csv.ts` the formula guard
   `/^\s*[=+\-@]/` runs on every value, so `-5` (a number) and `"-12.5"` export
   as `'-5` / `'-12.5` — wrong for balances, deductions, variances. Fix: skip
   the guard when `typeof value === "number"`, and for strings skip it when the
   whole cell matches a plain number (`/^\s*[-+]?\d+(\.\d+)?\s*$/`). Keep
   guarding `=…`, `@…`, and strings like `-1+cmd|…`. Add test cases for
   `-5`, `"-12.5"`, `"+234 803…"` (a phone number — decide and document:
   guard it, since `+` can start a formula), and `"=SUM(A1)"` to
   `lib/export/__tests__/csv.test.ts`.
3. **ListToolbar does not meet the Phase 2 spec.** The spec says the toolbar
   owns the search input (debounced 250 ms), filter selects using the same
   `DataTableFilter` shape, an optional view toggle and the result count, and
   is **URL-synced by reusing DataTable's `urlSync` code — not forked.** The
   current version is still a layout slot, and the documents browser hand-writes
   its own URL sync in a `useEffect`. Rework it:
   - Extract the URL read/write logic DataTable uses (it lives in
     `components/ui/data-table/use-data-table-state.tsx`) into a shared hook,
     e.g. `components/ui/data-table/use-url-list-state.ts`, and make both
     DataTable and ListToolbar use it. DataTable behaviour must not change.
   - `ListToolbar` takes `search`, `filters: DataTableFilter[]`, optional
     `view`, `resultCount`, and renders the controls itself.
   - Add `"use client"` to `list-toolbar.tsx` (it now has hooks).
   - Do not add new `setState`-inside-`useEffect` code. The documents
     browser's new `useEffect(() => setSubmittedSearch(...))` is that pattern —
     derive the active search from the debounced value instead.
   - Note: the documents search is server-side (it calls the files API), so a
     debounced live search now hits that API on every typing pause. Keep the
     250 ms debounce but skip queries shorter than 2 characters.
4. Run the checks, then commit Phase 2 as its own commit(s):
   `npx tsc --noEmit -p tsconfig.json`, `npx eslint --max-warnings=0 <changed>`,
   `npm test`.

## Step 2 — finish Phase 2, then continue

Migrate the remaining hand-rolled search/filter bars (grep
`placeholder="Search` outside `components/ui/data-table` and
`list-toolbar.tsx`) to `ListToolbar`, one area per commit. Then carry on with
**Phases 3, 4, 5, 6, 7 (and optional 8) exactly as written in
`docs/audit/2026-10-03-handoff-prompt.md`**, in order, finishing and committing
each before the next. For Phase 4, build on the existing split files: put
TanStack Table inside `use-data-table-state.tsx` and keep every file it
touches under 400 lines (it is 610 now; split it).

Things the previous agent did not do that you must:
- Run `npm run lint:strict` (repo-wide, zero warnings) at the end of each
  phase, not just eslint on changed files, and paste the tail into the report.
- Keep the `export` prop on server-paginated tables disabled until Phase 5's
  endpoint-backed fetch exists (cap 10k rows, toast if capped).

## Report

Append to `docs/audit/2026-10-handoff-report.md` (don't rewrite ChatGPT's
Phase 1 section): a "Fixes to Phase 1" section listing what you changed from
step 1, then one section per phase you did with commits, files
created/deleted, what you skipped and why, anything needing a DB change or a
decision, and the output tails of `npx tsc --noEmit`, `npm run lint:strict`,
`npm test`. Tick the audit rows you finish in
`docs/audit/2026-10-01-full-repo-critique.md` in the same style as the
existing ticked rows. Stop and report if you hit something that needs a
Supabase change, an external account, or a product decision.
