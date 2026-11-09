# Access Grants & Attendance Appeals — Implementation Plan

Agreed with the product owner, 8–9 Nov 2026. Nothing here is hardcoded to a person: every
"lead" below is whoever holds that lead role in `profiles` at the time.

## Terms

- **Admin role** — `profiles.role` of `admin`, `super_admin` or `developer`. Opens `/admin`. It is
  never, by itself, an approval position.
- **Admin & HR Lead** — the department lead of *Admin and HR*. An approval position (as in leave).
- **HCS Lead** — the department lead of *Corporate Services*.
- **ITC Lead** — the department lead of *IT and Communications*.
- **Grant** — permission to *view* or *edit* one `/admin` route key.
- **Delegate** — someone a lead has handed their edit access or approval authority to, until a date.

## Rules

### Access
- `/admin` grants only for people with the admin role; the server enforces it.
- Two levels per route: **view** (read-only) and **edit**.
- Edit/view levels apply to **HR** and **IT** routes now. Every other route keeps today's
  all-or-nothing grant.
- **Owners get edit automatically**: HR → Admin & HR Lead and HCS Lead; IT → ITC Lead.
- **Super admin / developer**: view every route; edit only with a grant. No page override.
- **Who grants**: super admin / developer, any route, never to themselves. A person with edit may
  delegate it (end date required), only to someone with the admin role. Delegates cannot
  re-delegate. Grants expire automatically.
- **Exit exception**: whoever performs an employee exit may suspend that person's mailbox login
  and set a forward. Restoring a login stays with IT.
- Owners for Corporate Services, Portfolios, Communications, Correspondence, Documentation,
  Reports, Help Desk: none for now.

### Attendance appeals
- The admin role never starts an appeal or attendance change.
- Staff → their lead → Admin & HR Lead.
- Lead's own appeal → Admin & HR Lead.
- Lead files for their staff → Admin & HR Lead. The 3-per-month LWP/AWP quota does not apply.
- Department with no lead → Admin & HR Lead.
- Admin & HR staff → one stage (Admin & HR Lead or her delegate).
- Admin & HR Lead's own appeal → she self-approves. Her active delegate may self-approve only
  while she is on approved leave. Both are marked **self-approved**.
- A delegate never approves their own items otherwise. Audit records "on behalf of".
- Nobody decides two stages of one request.
- **Stuck** = 5 working days with no action, or the stage owner is on approved leave with no active
  delegate. Only then can a super admin / developer override (reason required); the skipped
  person is notified immediately.
- **Expiry**: undecided appeals become `expired` at the end of the month after the appealed day
  (10 Nov → 31 Dec). The day stays as recorded; the employee is told.
- **MD check**: a "Self-approved appeals" section on MD's Desk plus a monthly in-app notification.
  No email.

## Phases

Each phase is one or more commits, verified with `tsc`, `eslint` and the relevant tests.
⚠ = touches production; shown to the owner for an explicit yes before it is applied.

### 1. URL moves (no DB change, nobody's access changes)
- PMS → `/admin/hr/pms`.
- IT pages (Onboarding, Mailboxes, Starlink, Network Activity, Bypass & Override) and Settings →
  Mail → `/admin/it/...`.
- Payroll, Inventory, Assets → `/admin/accounts/...`.
- Settings → Attendance / CBT → settings button top-right of the Attendance and CBT pages, opening
  `/admin/hr/attendance/settings` and `/admin/hr/pms/cbt/settings`.
- Sidebar, route keys (`lib/admin/policy-v2.ts`), redirects (`next.config.mjs`) for every old URL.

### 2. Grants table ⚠ migration
- `admin_route_grants`: user, route key, level, valid from/until, granted by, source
  (grant / delegation), delegated-from.
- Copy every existing `profiles.admin_routes` entry in as **edit**: no access change on day one.
- New IT route keys; extend the `admin_routes` CHECK allowlist.
- RLS on; writes only through server routes.

### 3. Permission checks
- `canView` / `canEdit` in `policy-v2.ts`, incl. automatic owner edit and the super/dev rule.
- Middleware gates pages on `canView`; `requireRouteEdit(routeKey)` for mutating APIs.
- Unit tests for every rule above.

### 4. APIs enforce grants
- HR and IT APIs first, incl. every `app/api/admin/mailboxes/**` route; keep the exit-flow
  mailbox steps working.
- Then every remaining admin API that only checks the admin role, one section per commit.

### 5. Screens
- Shared view-only notice naming who can edit (live names), disabled buttons with the reason, and a
  "acting as X's delegate until …" note.
- Settings → Users: None / View / Edit per route (admin role required).
- New Settings → Access: `DataTablePage` of every grant, filters, expiry flags, cancel.
- Profile: "Delegate my access" (person, routes, end date).

### 6. Cut HR and IT over to the new rules ⚠ live data
- Admins who are not owners or delegates move from edit to view on HR and IT routes. The exact
  list of people is shown first.

### 7. Attendance appeals
- Stage `pending_admin` is decided only by the Admin & HR Lead or her active delegate (stage value
  kept, label "Pending Admin & HR Lead"); notifications go only to them.
- Second-stage items move to the Admin & HR Lead's department console; `/admin` is read-only.
- Remove admin-initiated changes; lead-for-staff skips the quota; Admin & HR one-stage and
  self-approval rules; approval delegation on the department console.

### 8. Stuck items, expiry, MD check ⚠ migration
- Stuck flag + override availability + immediate notice to the skipped person.
- `expired` status, expiry job, "Overdue" section in the leads' daily summary.
- MD's Desk "Self-approved appeals" section + monthly in-app notification.

## Pending in production at planning time (9 Nov 2026)

| Stage | Started by | Count |
|---|---|---|
| Waiting on admin | Employee | 18 |
| Waiting on admin | Lead for staff | 1 |
| Waiting on lead | Employee | 21 |
| Waiting on lead | Admin | 19 |
| Waiting on Admin & HR Lead | Admin | 1 |

By appealed month: Jun 1, Aug 17, Sep 8, Oct 13, Nov 21. The 26 from Jun–Sep are already past
the expiry deadline.

## Decisions on rollout (9 Nov 2026)

- **In-flight admin-started changes (19)** finish under the old rule: the lead confirms and they
  are done. Only new requests follow the new rules.
- **Expiry backlog (26 past deadline)**: one-week grace from the first expiry run, and the Admin &
  HR Lead gets a list of them first; then they expire.
- **Production changes**: build and commit everything, then present all migrations and the HR/IT
  cut-over list together for one explicit yes before anything is applied.
- **Delivery**: new branch from `origin/main`, pushed, one PR. The owner merges.

## As built (9 Nov 2026)

Differences from the plan above, so the next reader is not surprised:

- **Grants table**: `admin_edit_grants` holds EDIT only (explicit grants and delegations). VIEW is still
  `profiles.admin_routes`; nothing was copied across. Owners (leads of the owning department) get edit
  from `lead_departments`, never from a stored row. Seeding nobody means the day-one cut-over is: edit
  is held by the Admin and HR, Corporate Services and IT and Communications leads only.
- **Where grants are managed**: Settings > Access (developers and super admins, all grants) and Settings >
  Delegation in the staff settings (anyone who owns or holds an explicit grant, for their own area). The
  Settings > Users edit dialog does not have a None/View/Edit choice.
- **Viewers**: a `ViewOnlyNotice` names who can change things on the HR, PMS and IT consoles, and every
  mutating call is refused server-side. Individual buttons are not disabled.
- **Delegates work on /admin**: the Admin & HR Lead's delegate decides the second stage from the Appeals
  tab on /admin/hr/attendance. The Admin & HR Lead also sees second-stage items on her department
  console. Delegates do not get access to the delegator's department console.
- **Single-day status changes** from /admin are refused (they start with the lead). Manual leave, OOS,
  exemptions and bulk ranges stay available to HR edit holders: leads cannot do them, so refusing them
  would leave nobody able to.
- **Who leads an owning department** is developer / super admin only (department-leads and employee
  profile routes), because lead status carries edit access and the Admin & HR Lead's approvals.
- **Expiry**: first run records the start and lists the backlog; nothing expires for a week after.
- **Not in the migrations**: no data is changed. The 19 admin-started appeals in flight finish under the
  old rule.

## Department delegation (10 Nov 2026)

Delegation is wider than the HR and IT edit grants: any department lead can hand some of their own
department's console pages to someone, until a date.

- **Where**: a "Delegate access" button at the top of every `/dept/[id]` page, for the lead (not for delegates).
  The lead picks a person, ticks pages from the list in `lib/dept/delegated-pages.ts`, sets an end date.
- **What a delegate gets**: the department in their sidebar and account menu with only the ticked pages;
  everything else under `/dept/[id]` redirects to their first page. A banner says who they act for and until when.
  They keep their own role: the lead's admin role is never inherited, and a delegate cannot delegate or grant onward.
- **Enforcement**: `resolveDeptScope` returns a scope with `delegation` set (table `dept_delegations`, migration
  `20261110110000`). Middleware refuses pages and `/api/dept/*` calls outside the ticked pages; `getRequestScope`
  refuses other API calls from the console unless the call belongs to a ticked page, or (for calls that belong to no
  known page) the page it was made from is ticked. That last rule rests on the Referer header, so a delegate crafting
  requests by hand could reach any API that honours the department context for this one department.
- **Admin edit grants** (HR and IT pages under `/admin`) are separate and unchanged: Settings > Delegation.
- **Not built**: "on behalf of" in the audit log for actions a delegate takes; delegations do not end on their own
  when the lead changes (a new lead withdraws them from the same dialog).
