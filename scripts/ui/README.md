# UI Consistency Tooling

Enforcement scripts for UI standards. `npm run ui:guard` runs `ui:audit` and `ui:ratchet`; it is part of the
pre-push hook and of CI. The standards themselves are in `AGENTS.md` ("UI guard" and "Page Types Standard").

## Scripts

- `node scripts/ui/audit-reusables.mjs` (`npm run ui:audit`)
  - Audits UI compliance rules:
    - every page has `loading.tsx` (a page that only redirects is exempt)
    - non-exempt pages use the shared header/wrapper
    - table surfaces use shared app/admin wrappers (or allowlist)
    - page-level metric cards use `StatCard` (or allowlist)
    - modal dialogs avoid bare `DialogContent` without responsive constraints
  - Reports heuristic findings (non-blocking):
    - pages with ad-hoc empty-state copy that do not use `EmptyState`
    - pages with ad-hoc error-state copy that do not use `ErrorState`
    - pages using raw `<section>` without `PageSection`
    - form-heavy pages using labels/inputs without `FormFieldGroup`
  - Writes report: `test-results/ui-audit-report.json` (git-ignored, not tracked).
  - Exits non-zero on violations.

- `node scripts/ui/audit-reusables.mjs --write-allowlist` (`npm run ui:audit:baseline`)
  - Appends current violations to the allowlist at `scripts/ui/ui-audit-allowlist.json`.
  - Use only for intentional exceptions such as standalone public pages.

- `node scripts/ui/ratchet.mjs` (`npm run ui:ratchet`)
  - For each rule in `ratchet-rules.mjs`, counts the pattern per file and compares it with
    `ratchet-baseline.json`. Fails if any file's count rose or a new file has any. Per file, so one file's
    fix cannot pay for another file's new violation.
  - `--summary` prints the totals per rule.
  - `--update` (`npm run ui:ratchet:update`) rewrites the baseline from the current tree, and refuses if
    any count is higher than the baseline. Run it after removing violations and commit the result.
  - `--update --allow-increase` accepts a rise. Only for adding a new rule.

- `node scripts/ui/ensure-loading.mjs` (`npm run ui:ensure-loading`)
  - Scans all `app/**/page.tsx` directories and creates a missing `loading.tsx` from a template matched by
    route type. Review what it generates before committing.
  - Writes report: `test-results/ui-loading-report.json`.

## Adding a ratchet rule

1. Add it to `RULES` in `ratchet-rules.mjs` (and a hint in `HINTS`). A rule turns a file's text into a number.
   Comments are stripped first unless the rule sets `raw: true`.
2. Add cases to `__tests__/ratchet.test.mjs` for what it counts and what it must ignore.
3. `node scripts/ui/ratchet.mjs --update --allow-increase`, then review the totals in the pull request.
4. Add a row to the table in `AGENTS.md` ("UI guard").

## NPM Commands

- `npm run ui:guard` audit + ratchet
- `npm run ui:audit`
- `npm run ui:ratchet`, `npm run ui:ratchet:update`
- `npm run ui:ensure-loading`
- `npm run test:ui-ratchet`

## Notes

- Keep allowlist entries minimal and intentional.
- Prefer removing allowlist entries as pages are migrated to shared patterns.
- Scripts must normalize Windows paths with `toPosix()` before matching routes.
