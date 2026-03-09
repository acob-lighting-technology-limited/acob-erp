# UI Consistency Tooling

This folder contains enforcement scripts for UI consistency standards.

## Scripts

- `node scripts/ui/ensure-loading.mjs`
  - Scans all `app/**/page.tsx` directories.
  - Creates missing `loading.tsx` with responsive skeleton templates matched by route type.
  - Writes report: `test-results/ui-loading-report.json`.

- `node scripts/ui/audit-reusables.mjs`
  - Audits UI compliance rules:
    - every page has `loading.tsx`
    - non-exempt pages use custom header/wrapper
    - table surfaces use shared app/admin wrappers (or allowlist)
    - page-level metric cards use `StatCard` (or allowlist)
    - modal dialogs avoid bare `DialogContent` without responsive constraints
  - Reports heuristic findings (non-blocking):
    - pages with ad-hoc empty-state copy that do not use `EmptyState`
    - pages with ad-hoc error-state copy that do not use `ErrorState`
    - pages using raw `<section>` without `PageSection`
    - form-heavy pages using labels/inputs without `FormFieldGroup`
  - Writes report: `test-results/ui-audit-report.json`.
  - Exits non-zero on violations.

- `node scripts/ui/audit-reusables.mjs --write-allowlist`
  - Updates baseline allowlist at `scripts/ui/ui-audit-allowlist.json`.
  - Use when intentionally accepting known exceptions.

## NPM Commands

- `npm run ui:ensure-loading`
- `npm run ui:audit`
- `npm run ui:audit:baseline`

## Notes

- Keep allowlist entries minimal and intentional.
- Prefer removing allowlist entries as pages are migrated to shared patterns.
