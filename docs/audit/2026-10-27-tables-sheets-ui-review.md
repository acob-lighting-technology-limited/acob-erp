# Tables, expanded rows, sheets and modals — UI review (2026-10-27)

Scope: every `DataTable` in `app/` and `components/` (105 files, 73 with
`expandable`), every side sheet (12) and the bottom sheet `DataTable` renders,
and every dialog a table row opens. Found by a scripted sweep for known
anti-patterns, then reading the flagged files. Line counts are from the sweep.

Fix order: §1 first, because one change in `components/ui/data-table/` fixes
~70 tables at once. §2–§4 are per-page.

---

## 1. `DataTable` itself (one fix → ~70 tables)

### 1.1 Card view: tapping an expandable card does nothing — **bug**
`data-table.tsx` card grid (`handleCardClick`, ~L1796): when the row is
expandable it calls `toggleExpand(rowId)`, but the card grid never renders
`expandable.render`. The tap flips hidden state and nothing happens; the
detail sheet is never reached either because `canExpand` wins.
**69 tables** have both `expandable` and `cardRenderer`.
**Fix:** in card view, skip `canExpand` and go straight to the detail sheet.

### 1.2 Phone list: a row tap expands the desktop panel inline instead of opening the sheet
Contacts list `handleSelect` (~L1552): `if (canExpand) toggleExpand(...)`
runs before `detailConfig`. On a phone, every expandable table (**73**)
squeezes its desktop two-column panel under the row (`p-3 text-xs`) and the
bottom sheet is unreachable. This contradicts AGENTS.md ("a row tap opens the
sheet") and AGENTS.md is also stale: it says "`expandable` never fires" in
contacts view, but it does.
**Fix:** on the list, open the bottom sheet and render `expandable.render(row)`
as a section under the fields, so the timeline, attachments and similar
content still reach phones. Then update AGENTS.md to match.

### 1.3 Expanded cell padding is doubled on 27 tables
The expanded `TableCell` already has `p-4` and a `bg-muted/30` row. 27 panels
add their own `p-4`–`p-6`, `border`/`border-t`, `rounded-lg` and background,
so content sits 32–40px in, inside a box inside a tinted row. This is the main
source of the "excess space" look.
Worst: audit-logs, admin-feedback, admin-help-desk and job-descriptions
(`border-t p-6`); bypass-override (`border-2 p-4`); employees (`p-6`); every
staff-side `bg-muted/20 rounded-lg border p-4` panel (assets, help-desk, leave,
fleet, notifications, peer-feedback, feedback, scorecard register, user tasks
plan, projects, portfolios).
**Fix:** `DataTable` owns the frame; panels render content only. Remove the
outer padding, border and background from each panel's root.

### 1.4 No shared building blocks for expanded panels
Every panel hand-rolls its own label/value markup, in four styles:
`Label: value` inline, uppercase 10px label over value, bordered tile per
field, and `<dl>`. Per AGENTS.md ("new table capabilities go in
`components/ui/data-table/`"), add `DetailList` / `DetailField` /
`DetailSection` there. The leave page's `leave-detail-sections.tsx` already has
the shape to promote.

---

## 2. Expanded views (per page)

### 2.1 Panels that only repeat columns — delete or cut to the new fields
Each of these is four bordered tiles (`rounded-lg border p-4`, uppercase
label), and most tiles repeat a visible column:

| Page | Expanded fields | New info |
|---|---|---|
| accounts/bills | Supplier, Total, Balance Due, Due Window | Balance Due only |
| accounts/invoices | Customer, Email, Paid, Balance Due | Email, Paid, Balance |
| accounts/reports | Title, Department, Category, Created | Created only |
| purchasing/orders | Supplier, Order Date, Expected, Delivery Window | **none** |
| purchasing/receipts | Receipt No, PO Ref, Supplier, Item Volume | **none** |
| purchasing/suppliers | Email, Phone, Address | Phone, Address |
| inventory/products | Description, Category, Reorder Level, Stock Band | Description, Reorder |
| inventory/movements | Product, Operator, Reference, Notes | Notes |
| inventory/categories | Description, Product Mapping, Coverage Band | **none** |
| inventory/warehouses | Address, Region, Status | **none** |
| dev/login-logs | Email, Department, IP, User Agent | Email, User Agent |

Remove `expandable` where the "New info" column says none; elsewhere keep
only the new fields as one `DetailList` line.

### 2.2 Same faults as the old leave panel (title repeated, nested boxes, 10px labels)
- `(app)/tasks/management/tasks-content.tsx` (112 lines): repeats the task
  title, has a description box inside a bordered panel, 10 "Label:" fields in
  a bordered grid with `text-[10px]` labels, and three coloured callout boxes.
- `admin/tasks/management/admin-tasks-content.tsx` (102 lines): same
  structure, 8 "Label:" fields.
- `admin/correspondence/admin-reference-generator-content.tsx`: 7 inline
  `Label: value` lines with `|| "-"` fallbacks and a raw `due_date` string.
- `components/pms/cbt-question-manager.tsx`: 9 inline `Label: value`.
- `admin/audit-logs`: three columns of `Label: value` under `font-black
  text-[10px]` headings, inside `p-6`, plus a "Comprehensive View" button.
  The detail sheet already shows all of this, so the panel can be a one-line
  summary.
- `(app)/hr/leave/leave-content.tsx` (staff leave, 68 lines): the staff twin
  of the admin row I just fixed. It should reuse `leave-detail-sections.tsx`.

### 2.3 Too large to stay inline — move into `_components/`
`(app)/hr/attendance/attendance-content.tsx` (194 lines),
`corporate-scorecard-register.tsx` (180, with 16 sub-12px classes),
`hr/attendance/_components/appeals-view.tsx` (138),
`admin-user-tasks-plan.tsx` (124).

### 2.4 Raw `<Table>` inside an expanded row (7)
Scorecard register, admin-user-tasks-plan, staff action-tracker,
pms-metric-tabs-page, admin action-tracker, offices-rooms, departments.
A breakdown with fixed columns is allowed by AGENTS.md. Check that each one is
that kind of breakdown and not a list of records.

### 2.5 Placeholder fallbacks
10 panels use `|| "-"`, and the house value is `—`. offices-rooms,
departments, payments-table, reference-generator, acobot logs, cbt question
manager, assets, login-logs, pms cbt details, pms development-plans.

---

## 3. Tables before expanding (Table Page Standard)

- **Sub-12px text:** 80 of 105 table files use `text-[9px]`–`text-[11px]`.
  AGENTS.md sets `text-xs` as the minimum. Worst are badges in cells and
  expanded labels. This is a mechanical sweep, best done one feature folder
  per commit.
- **`<DialogContent>` inside a page component (prohibited): 25 files.**
  Staff: payroll, leave, fleet, peer-feedback, action-tracker, reviews,
  feedback. Admin: department-cascade, login-logs, survey-analytics,
  attendance records, attendance, departments, lunch, offices-rooms, inventory
  categories and warehouses, payroll and payroll/[id], pms competencies,
  cycles, development-plans and peer-feedback, action-tracker, admin tasks.
  Move each to `_components/`. Most are forms that should also be
  `ResponsiveModal` on phones.
- **No metrics (stats or statBadges): 4.** Staff notifications, admin
  notifications, dev/login-logs, pms/cbt/details.
- **No filters: 2.** requisitions payment-processors tab and scorecard
  summary. Both may be lookup tables where filters add nothing; decide per
  page.
- **No `DataTablePage`:** dev/impersonation. The attendance sub-views are
  correctly embedded in the attendance page.
- **Crowded tables:** lunch has 9 row actions (group them, or move the rare
  ones into the sheet). controlled-docs register has 7, and mailboxes and
  portfolios have 5. pms analytics, daily roster, payroll/[id], pms reviews,
  pms development-plans and admin assets each have 9–10 columns. Check that
  `hideOnMobile` and column visibility defaults leave a readable table at
  1280px.

---

## 4. Side sheets and bottom sheet

### 4.1 No shared shell: 12 sheets built by hand, at 4 widths
`sm:max-w-lg` (event), `xl` (leave, md-queue), `xl/2xl` (audit, docs ×2,
feedback, ticket, task, requisition), `2xl/3xl` (payment). Each rebuilds its
own header, scroll body and footer.
**Fix:** add a `DetailSheet` shell to `components/ui/` with these slots:
header (avatar/title/meta, badges kept clear of the close button), scrolling
body with `divide-y` sections, and a sticky footer for actions. Standard width
`sm:max-w-xl`, and `2xl` only for document previews. The payment and
requisition sheets already reserve `pr-8` for the close button, so copy
their header.

### 4.2 Per-sheet problems
- `components/audit/AuditLogDetailPanel.tsx`: 9 bordered boxes. Same card-in-
  card stack as the old leave sheet.
- `components/requisitions/requisition-preview-sheet.tsx`: 9 boxes and 7
  uppercase headings.
- `app/admin/hr/attendance/_components/appeal-review-dialog.tsx`: 7 boxes,
  and the header reserves only `pr-6` while badges sit right-aligned next to
  the close button at `right-4`, so they can collide.
- `components/tasks/UserTaskDetailsDialog.tsx`: 6 sub-12px classes, no
  footer.
- `components/help-desk/user-ticket-details-dialog.tsx`: sub-12px, no footer.
- `components/documentation/doc-view-dialog.tsx`: no footer or actions.
- **Naming:** 7 sheets are named `*Dialog` (leave-detail-dialog,
  appeal-review-dialog, controlled-doc-view-dialog, doc-view-dialog,
  feedback-detail-dialog, user-ticket-details-dialog, UserTaskDetailsDialog).
  Rename them to `*-sheet` when touched. The wrong name is how they keep
  getting treated as modals.

### 4.3 The `DataTable` bottom sheet
Every field is its own bordered tile (`rounded-lg border p-2.5`), so a
10-field record is 10 boxes. Labels are `text-[11px]`. Use a plain two-column
`<dl>` with dividers, and keep tiles only for fields you can tap (copy or
link).

---

## 5. Row actions that open a modal but should open a sheet

Rule applied: **viewing a record → sheet; creating, editing or confirming →
dialog** (`ResponsiveModal` on phones). Forms and confirmations below are
correct as dialogs and are not listed.

| Table | Opens | Size | Should be |
|---|---|---|---|
| hr/employees "View Full Profile" | `EmployeeViewModal` | `max-w-5xl` | sheet (with edit in the footer) |
| assets → history | `AssetHistoryDialog` | 3xl | sheet |
| assets → issues | `AssetIssuesDialog` | 2xl | sheet (list + add issue) |
| admin documentation → view | `admin-doc-view-dialog` | 3xl | sheet; the staff side already uses the `doc-view-dialog` **sheet** for the same content |
| hr/job-descriptions → view | `job-description-dialog` | 3xl | sheet |
| settings/roles → users | `role-users-dialog` | 3xl | sheet |
| hr/lunch → viewers | `lunch-menu-viewers-dialog` | 3xl | sheet |
| dev/login-logs → "Access Profile" | inline Dialog | 3xl | sheet |
| pms/peer-feedback → details | inline Dialog | 2xl | sheet |
| admin action-tracker → department action points | inline Dialog | 3xl | sheet |
| staff action-tracker → department | inline Dialog | 2xl | sheet |
| feedback/surveys → response | inline Dialog | xl | sheet |
| staff payroll → "View Payslip" | inline Dialog | 2xl | can stay a dialog: it is a printable document preview |

Correct already: audit-logs → `AuditLogDetailPanel`, tasks →
`UserTaskDetailsDialog`, help-desk → ticket sheet, payments and requisitions →
preview sheets, leave → leave sheet. All are sheets despite their names.

---

## Suggested order of work
1. `DataTable`: §1.1 card tap, §1.2 phone tap → sheet with expanded content,
   §4.3 bottom sheet fields. One PR. Update AGENTS.md in the same PR.
2. `DetailList`/`DetailSection` in `components/ui/data-table/` and a
   `DetailSheet` shell (§1.4, §4.1).
3. Expanded panels: strip outer padding (§1.3) and delete or trim the
   column-repeating panels (§2.1). Mostly deletions.
4. Rebuild the tasks, audit-log, reference and staff-leave panels on the
   shared pieces (§2.2) and extract the oversized ones (§2.3).
5. Move the §5 viewers to `DetailSheet`, rename the `*Dialog` sheets, and fix
   the §4.2 sheets.
6. Mechanical sweeps: sub-12px text, `DialogContent` out of page files, `—`
   fallbacks.
