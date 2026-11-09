# Prompt for Gemini — Make the Help Desk standalone (tickets, not tasks)

Copy everything below the line into Gemini. It is written to be self-contained.

---

## 0. Read first (mandatory)

You are working in the ACOB Matrix repo (Next.js + Supabase). Before touching anything:

1. Read `AGENTS.md` fully. Every rule is mandatory. Pay particular attention to:
   **Engineering Practices** (reuse before you write; one component per screen across
   staff/admin/dept; all writes server-side; zod on every route; fix the cause, not the
   symptom), **Database Security Standard**, **Notification System**, **Email and In-App
   Notification Parity**, **Email Identity, Routing, and Subjects**, **Version History**.
2. Read `CLAUDE.md`. Key points: **never run `npm run build`**; verify with
   `npx tsc --noEmit -p tsconfig.json` and `npx eslint <changed files>` plus the relevant
   tests; **never open a browser or preview tool** to verify; there is **no staging
   database**, so you must NOT apply any migration or write to the live Supabase project —
   write migration files only and show them to the user for an explicit "yes".
3. Git: no worktrees; no `Co-Authored-By` trailer and no "Generated with…" footer anywhere;
   commit body lines must be 100 characters or fewer (use `git commit -F <file>`; the hook
   hides commitlint errors); commit only complete, verified units; stage only your own paths.
   The working tree already has unrelated changes (`components/employees/employee-profile-sheet-view.tsx`,
   `docs/scorecard/`) — do not touch or stage them.
   Before starting run `git fetch` and check whether the current branch
   (`feat/task-form-layout`) is already merged into `origin/main` (PR #204 was). If so,
   create a fresh branch `feat/help-desk-standalone` from `origin/main`. If a PR for your
   branch is already open, push follow-ups to it instead of opening another.

## 1. What we are doing and why

The Help Desk is a way for one department to ask another department for support.
Today every ticket is also **mirrored into the `tasks` table** (a second record with a
`TSK-` number). That is broken in practice:

- The mirror task is created by `syncHelpDeskTicketTask()` in `lib/help-desk/server.ts`
  with **no weight**, so it silently gets the column default (3). Weight is the denominator
  of KPI, and KPI is 70% of the appraisal. No lead ever sets it, because the lead did not
  create the task.
- On resolve the ticket route flips the task to `completed` **with no rating**, which the
  scoring code (`lib/tasks/scoring.ts`, `isAwaitingRating`) leaves out of the score forever.
- A ticket's SLA date becomes the task's `due_date`, so the nightly expiry job
  (`lib/tasks/overdue.ts` and its cron) can mark an assignee's ticket task `failed`,
  which scores **zero at full weight**. Verify whether the job filters on `source_type`.
- Any staff member can raise work that lands on a colleague's KPI. We have already had to
  block self-rating (`tasks_guard_self_rating`) after 30 self-rated tasks.
- Two numbers for one request (`HD-…` and `TSK-…`). A September migration
  (`20260903223000_relink_help_desk_tickets_to_tasks.sql`) deliberately kept HD and TSK
  numbering separate so declined tickets don't burn TSK numbers. Keep it that way.

**Decision (made by the user, do not re-litigate):** the Help Desk becomes **standalone**.
A ticket keeps only its `HD-` number. It no longer creates, syncs to, or links to a task.
It must still **look and behave like Tasks** so staff are familiar with it. The only
differences from Tasks are **who creates it, who assigns it, and who grades it**.
A lead can optionally **convert** a ticket into a real task, and that is the only
moment weight and KPI enter the picture.

## 2. Agreed design

### Creating a ticket
- Requester picks a **department** (their own department stays excluded, except global
  admins as today).
- Requester may optionally pick a **specific person** in that department. People on leave
  are **selectable** but shown as e.g. "On leave until 12 Nov".
- No person picked → ticket goes to the department queue (today's behaviour).
- Person picked → ticket is assigned directly: `assigned_to` set, `handling_mode =
  'individual'`, status `assigned`, `assigned_by = requester`, `assigned_at = now`.
  The department lead is **always notified** (visibility, so they can reassign).
  If the chosen person is on leave, the lead's notification says so.
- Keep priority. Remove `request_type` entirely (it is a one-value field now).

### Who can do what (put this in ONE module, `lib/help-desk/permissions.ts`, used by the
API routes and the UI; reuse `canLeadDepartment` / `isAdminRole`)
| Action | Allowed |
|---|---|
| Accept to queue / reassign / send back to queue | Receiving department's lead (and global admin) |
| Start work, pause | Assignee, receiving lead, global admin |
| **Mark resolved** | Assignee, receiving lead, global admin |
| **Close (complete) with a rating** | Requester, receiving lead, global admin — **never the assignee** |
| Convert to task | Receiving lead (and global admin) |
| Cancel | Requester (before work starts), receiving lead |

Every resolve/close action records **who did it** (`resolved_by`, `closed_by`) and the
detail view shows it, e.g. "Resolved by Jane · Closed by Chinedu (Requester)".

### Rating (replaces CSAT)
- Replace `csat_rating` / `csat_feedback` with a **1–5 service rating** (same numeric rule
  as tasks: no text labels) and an **optional comment**.
- The rating is **required** when closing a ticket (like tasks require it to complete).
  Whoever closes it (requester or lead) gives it; store `rated_by` and `rated_at`.
- The assignee can never rate their own ticket (application check, plus mirror the
  `tasks_guard_self_rating` idea in a DB trigger if appropriate).
- Label it **"Service rating"** everywhere. It must **never feed KPI**: do not import it
  into `lib/tasks/scoring.ts` or any PMS code. Show it to leads as a service stat only.
- Reuse the task rating control. Extract the rating input from
  `components/tasks/TaskReviewDecisionDialog.tsx` into a shared component and use it in
  both places. Do not copy it, and do not change task behaviour.

### Lead actions (admin help desk view)
- **Reassign** to another person in the department, from any open status
  (`assigned`, `in_progress`, `paused`, not only queue statuses as the assign route allows
  today). Notify old and new assignee. Record an event.
- **Mark resolved / close** on the requester's behalf, with the same rating rules.
- **Convert to task**: opens the existing task form prefilled from the ticket (title,
  description, priority, department, assignee). The lead must set **weight** (compulsory,
  1–10) and the other required task fields. Creation must go through the **same code path
  as normal task creation** — extract a shared function into `lib/tasks/` if the logic
  lives only inside the route; do not duplicate it. The new task uses
  `source_type = 'help_desk'`, `source_id = ticket.id`.
  Afterwards the ticket becomes a terminal status `converted` with `converted_task_id`
  set, the requester is notified ("now tracked as TSK-…"), and **no ticket rating is
  collected** (the task carries the scoring, so the same work is never rated twice).
  The requester sees a read-only link/status for the task, nothing more.

### Numbers
Tickets show **`HD-` only**. Everywhere that currently falls back to
`syncResult?.workItemNumber` must use `ticket_number`.

## 3. What exists today (so you don't re-derive it)

- `app/api/help-desk/tickets/route.ts` — POST creates ticket; has the
  `request_type` literal, a "modern then legacy payload" fallback insert triggered by error
  text containing "column"/"check constraint" (**delete this fallback**, per AGENTS "fix the
  cause, not the symptom"), `approval_required: false`, `current_approval_stage: null`,
  `category_id: null`. Lead notification + `sendHelpDeskMail` after insert.
- `app/api/help-desk/tickets/[id]/route.ts` — GET/PATCH. Contains
  `VALID_HD_TRANSITIONS` (includes procurement statuses to delete), a **goal gate**
  (lines ~191–212: refuses `in_progress/resolved/closed` unless the linked task has a
  `goal_id` — **delete**, it exists only because of the mirror task), a rule that
  department tickets can only be updated by leads from Admin Help Desk (**replace** with the
  permission table above), CSAT handling (replace), and calls to `syncHelpDeskTicketTask`
  (**remove**).
- `app/api/help-desk/tickets/[id]/assign/route.ts` — lead-only assign, actions
  `assign_staff | assign_me | send_to_queue | assign_department`, limited to statuses
  `new/pending_lead_review/department_queue/department_assigned`, uses
  `getUnassignableReason` which requires `employment_status = 'active'`. Calls
  `syncHelpDeskTicketTask` (**remove**).
- `lib/help-desk/server.ts` — `HELP_DESK_STATUSES` (includes `pending_approval`,
  `approved_for_procurement`, `pending_lead_review`, `new`), `syncHelpDeskTicketTask`,
  `normalizeTaskStatusFromTicket` (both **delete**), `resolveLeadForDepartment`,
  `canLeadDepartment`, event/audit helpers (keep).
- `components/help-desk/create-ticket-dialog.tsx` — the form; has a "Need something bought
  or paid for?" banner linking to `/accounts/requisitions` (shrink to one line, keep the
  link) and an `ItemInfoButton` whose copy still says tickets can ask for a "purchase"
  (rewrite).
- `components/help-desk/user-ticket-details-dialog.tsx`, `ticket-queue-table.tsx`,
  `ticket-attachments-panel.tsx`, `help-desk-types.ts`; pages
  `app/(app)/help-desk/{page,help-desk-content,[id]/ticket-detail-content}.tsx`,
  `app/admin/help-desk/{page.tsx,_lib/load-help-desk.ts,management/admin-help-desk-content.tsx}`,
  `app/dept/[dept_id]/help-desk/page.tsx`. Per AGENTS these are one feature component set
  under `components/help-desk/` with thin route wrappers — keep it that way. List pages must
  use `DataTablePage`/`DataTable` (Table Page Standard).
- `app/(app)/help-desk/page.tsx` loads `goals_objectives` titles for a "goal" column —
  **remove the goal column and loader** (goal linkage belongs to the converted task).
- Requisition linkage to remove: `components/requisitions/ticket-requisitions-card.tsx`
  (delete), `app/api/help-desk/tickets/[id]/requisitions/route.ts` (delete), the
  `helpDeskTicket` prop and related copy in `components/requisitions/new-requisition-dialog.tsx`,
  `requisition-detail.tsx`, `app/api/requisitions/route.ts`, `lib/requisitions/{types,schemas,server,notify}.ts`.
  Keep the DB column that links a requisition to a ticket for history; remove all UI/API
  that creates or edits that link. Check every reference with grep before deleting.
- Leave data: `lib/admin/away-today.ts` (`loadAwayToday`) already knows who is away today.
  Read it and reuse it, do not write a second leave query. `lib/tasks/overdue.ts` is
  leave-aware and may have useful helpers for "on leave until".
- Profiles RLS shows an employee only their own row. For org-wide name lookups use the
  `staff_directory` view (see how existing routes use it), through a new server route.
- Other mentions of help desk to update: `app/api/search/route.ts`,
  `lib/acobot/{context.ts,system-prompt.ts,training-qa.md}`, `lib/guide/content.ts`,
  `lib/notifications/{subject-policy.ts,delivery-policy.ts}`, `lib/audit/*`,
  `components/profile/{work-items.ts,needs-attention.tsx}`, `components/universal-search.tsx`,
  `tests/e2e/help-desk-flow.spec.ts`, `tests/e2e/helpers/seed.ts`,
  `app/admin/dev/tests/_components/HelpDesk*`.
  Anywhere that says tickets create tasks, or shows a ticket's TSK number, must change.

## 4. Work plan — do it in this order, and stop at the marked gate

**Phase A — read-only investigation (no code, no DB writes)**
1. Count the existing mirror tasks. Run these read-only against the live database *only if
   you have a read-only connector*; otherwise write the SQL into
   `docs/help-desk-mirror-task-count.sql` and ask the user to run it and paste results:
   ```sql
   select status, (rating is not null) as rated, count(*)
   from public.tasks where source_type = 'help_desk' group by 1,2 order by 1,2;

   select count(*) filter (where task_id is not null) as linked,
          count(*) as total
   from public.help_desk_tickets;

   select conname, pg_get_constraintdef(oid)
   from pg_constraint
   where conrelid = 'public.help_desk_tickets'::regclass and contype = 'c';
   ```
2. Check whether the nightly expiry job fails `source_type = 'help_desk'` tasks.
3. Grep the full list of references in section 3 and note any I missed.
4. **GATE:** report the counts and findings to the user, with your proposed handling of
   existing mirror tasks, and wait. Proposed default: leave every completed/rated task
   untouched (it is real appraisal history); cancel only open, unrated mirror tasks (the
   scoring code excludes cancelled tasks entirely); stop reading `help_desk_tickets.task_id`.
   Do not delete any task row.

**Phase B — remove the coupling (code only)**
Delete `syncHelpDeskTicketTask` and its two callers, the goal gate, the goal column, the
mirror-task notification wording; switch all messages to `ticket_number`.

**Phase C — cleanup**
Remove the requisition card/route/props, procurement statuses and transitions,
`approval_required`, `current_approval_stage`, `category_id`, `request_type`, the legacy
insert fallback, the approvals-route code that is now unreachable (check
`help_desk_approvals` usage first), and fix the info-popover and banner copy.

**Phase D — new behaviour**
1. `lib/help-desk/permissions.ts` (pure functions, unit-tested).
2. Create form: optional person select. New server route, e.g.
   `GET /api/help-desk/assignees?department=…`, returning only `id`, display name and
   `on_leave_until` (nothing else), with zod, rate limit, auth. Active staff plus staff on
   leave; still reject terminated/inactive. Validate again server-side on POST
   (`assigned_to` must belong to `service_department`). Note `getUnassignableReason`
   currently requires `employment_status = 'active'`; add an explicit option rather than
   weakening it for other callers.
3. Resolve/close flow with `resolved_by`, `closed_by`, rating (required on close),
   optional comment, "marked by" display.
4. Lead reassign from any open status.
5. Convert to task (`POST /api/help-desk/tickets/[id]/convert-to-task`) and the
   `converted` status.
6. Shared rating input extracted from `TaskReviewDecisionDialog`.
7. UI parity: ticket detail uses the same `DetailSheet`/layout vocabulary, `StatusBadge`,
   comments and attachments building blocks as the task sheet (recent commits
   `5270bea7`, `6024da27` already moved both to `DetailSheet`). Share components, **not**
   data or the status machine; tickets keep their own statuses.
8. Notifications and email for every new event (assigned directly, lead FYI, on-leave
   warning, resolved, closed, converted, reassigned) following the in-app/email parity
   standard. Loop recipients individually for email.
9. Audit log + `help_desk_events` row for every state change.

**Phase E — migrations (files only, DO NOT APPLY)**
Create files in `supabase/migrations/` with a timestamp later than the newest existing one:
- add `resolved_by`, `closed_by`, `rating` (1–5 check), `rating_comment`, `rated_by`,
  `rated_at`, `converted_task_id`; backfill `rating`/`rating_comment` from
  `csat_rating`/`csat_feedback` with `rated_by = requester_id` where present;
- extend the status CHECK constraint (use the constraint definition from Phase A, don't
  guess) to add `converted` and keep old values valid until the drop migration;
- follow the Database Security Standard for any new column grants/RLS/functions;
- put the **destructive** part (dropping `approved_for_procurement`/`pending_approval`
  handling, `approval_required`, `current_approval_stage`, `category_id`, `request_type`,
  `csat_*`, `task_id`) in a **separate later file** that is clearly labelled as a follow-up
  to run only after the code has been live and verified.
Show both SQL files to the user and wait for an explicit "yes". Never push or apply them.

**Phase F — tests, docs, release notes**
- Unit tests for `permissions.ts`; update `tests/e2e/help-desk-flow.spec.ts` and the seed
  helper (assign → resolve by assignee → close with rating by requester; and
  convert-to-task).
- Add a line to the current month's release in `lib/version-history.ts` (area: help desk),
  written for staff, in the same commit as the user-visible change. Consider a
  `lib/whats-new.ts` entry since this is a visible change for staff.
- Update AcoBot prompts/training and `lib/guide/content.ts` (tickets no longer create
  tasks; service rating; who can close).

## 5. Verification (no build, no browser)
```bash
npx tsc --noEmit -p tsconfig.json
npx eslint <every file you changed>
npx vitest run <relevant tests>   # use the project's existing test scripts
```
Report exactly what you ran and the results. If something fails, say so with the output.
Do not claim anything is verified in the UI — you are not allowed to open one.

## 6. Out of scope — do NOT build, ask first
- Auto-closing a resolved ticket after N days with no confirmation.
- Feeding service ratings into KPI/appraisals.
- Merging `help_desk_tickets` into `tasks`.
- Renaming routes or the module (it stays "Help Desk"; items are "tickets").
- Changing task behaviour, task scoring or the nightly expiry job.

## 7. When finished, report
1. What changed, grouped by commit.
2. Phase A numbers and what you did about existing mirror tasks.
3. The two migration files, with a plain-English summary of each, and confirmation that
   neither has been applied.
4. Anything you could not verify or decided differently from this brief, and why.
