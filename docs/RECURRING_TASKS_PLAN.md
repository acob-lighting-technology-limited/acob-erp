# Recurring Tasks — Build Plan

Status: **built on `feat/recurring-tasks` (2026-10-30); migrations `20261030120000` and
`20261030130000` not yet applied to the live database**

A lead can set a task to repeat. Each repeat is a normal task row, so overdue
grace, reminders, rating and PMS keep working unchanged.

## Agreed behaviour

| Topic | Decision |
|---|---|
| Structure | A **series** (the recipe) creates one ordinary task per due date |
| Repeat options | Does not repeat (default), Every working day, Weekly, Monthly, Quarterly, Yearly |
| Daily | Working days only — weekends and public holidays skipped |
| Weekly | Lead picks the weekday (Mon–Fri) |
| Monthly | "Day number" or "Last day of month"; a day the month doesn't have (31st) falls on its last day |
| Quarterly | Calendar quarters — due end of Mar, Jun, Sep, Dec |
| Yearly | Lead picks month + day |
| Creation | By the calendar, ahead of the due date; never duplicated, never skipped because the last one wasn't done |
| Ending | Starts on a date; Ends: Never / On a date |
| Reassign | On the series, effective from a chosen date; past tasks stay with the original person; asks whether to move the currently open task too |
| Stop early | "End series" with a reason (Completed early / No longer needed); open future tasks close as not planned |
| Pause | Manual, by the lead only — nothing automatic for leave. Tasks due inside the pause: daily/weekly are **skipped** (closed as not planned); monthly/quarterly/yearly are **moved** to the first working day after the pause. Heads-up + Confirm, no choice to make. Moving one task never shifts the series schedule |
| Editing | Changes apply to tasks not yet created only |
| Cancel/close | Existing `cancelled` status + required reason (Not planned / Duplicate / Other + note); not counted against PMS |
| PMS | A series counts as **one item** per review cycle, scored by the average of its tasks |

## What the existing code means for this

Findings from reading the task code — each one shapes the design:

1. **Tasks are capped at five working days** (`lib/tasks/deadline-window.ts`,
   enforced in `POST /api/tasks`). So a generated task is created at most five
   working days before it is due. That fixes the lead time per frequency (below).
2. **Every task needs a KPI and a weight (1–5)** (`lib/tasks/schemas.ts`). The
   series carries both and stamps them on every task.
3. **Completing a task requires the lead's rating** (`status` route). A daily
   series is ~22 ratings a month per person. Without a bulk approve this becomes
   the lead's biggest complaint — so bulk approve is in scope (phase 6).
4. **Scoring is weighted per task**: `SUM(weight × rating/5) / SUM(weight)`
   (`lib/tasks/scoring.ts`). "One item per series" is done by grouping a series'
   tasks into a single entry inside `computeWeightedTaskScore`, after the cycle
   filter — so a series that spans two cycles scores once in each.
5. **Multi-assign already fans out to independent rows**. A recurring task for
   three people becomes three series, one per person — same rule, same reasons.
6. **The nightly expiry job fails overdue tasks after 2 working days**
   (`app/api/cron/tasks/expire-overdue`). It must skip tasks whose series is
   paused, or a held monthly task gets failed during an open-ended pause.
7. **Existing hole: employees can cancel their own tasks.** The UI treats
   `cancelled` as reviewer-only (`TaskStatusControl.tsx`), but the API's
   `EMPLOYEE_TRANSITIONS` allows `pending|in_progress → cancelled`, and
   cancelled tasks are excluded from the score. An employee can dodge a failure
   by cancelling. Recurring tasks multiply this, so it is fixed first.

## Lead time (when each task is created)

All within the five-working-day cap. The task's start date is its creation date.

| Frequency | Created | Due |
|---|---|---|
| Every working day | That morning | Same day |
| Weekly | Monday of that week | The chosen weekday |
| Monthly / Quarterly / Yearly | 5 working days before due | The scheduled date |

If a scheduled due date lands on a weekend or holiday it moves to the
**previous** working day — unless that would leave its month, in which case it
moves forward ("monthly on the 1st" with a Sunday 1st is due Monday the 2nd).

## Phases

Each phase is one commit, verified with `tsc`, `eslint` and the tests named.

### Phase 0 — Close the self-cancel hole (separate, small)
- `app/api/tasks/[id]/status/route.ts`: remove `cancelled` from
  `EMPLOYEE_TRANSITIONS`; make cancel reviewer-only, matching the UI.
- Require a cancel reason: new `tasks.cancel_reason` (`not_planned`,
  `duplicate`, `other`) + note stored in the existing comment trail.
- Cancel dialog in `TaskReviewDecisionDialog.tsx` with the reason picker.

### Phase 1 — Migration
- `task_series`: title, description, priority, department, kpi_id (required),
  goal/project/plan/portfolio links, weight, frequency, weekday, monthly_mode,
  monthly_day, yearly_month, start_date, end_date, status
  (`active|paused|ended`), paused_from, paused_until, end_reason,
  created/updated/ended by + at.
- `task_series_assignees (series_id, assigned_to, effective_from)` — dated
  reassignments and the assignee history in one table.
- `tasks`: `series_id` FK, `occurrence_date`, unique `(series_id, occurrence_date)`
  — the guarantee that a double cron run can never create duplicates.
- RLS on, per the Database Security Standard: select for the assignee, leads in
  scope and admin-like; no insert/update/delete grants to `authenticated` or
  `anon` — all writes go through the API with the service role.
- `cron.schedule('app-tasks-generate-recurring', …)` daily at 04:00 UTC
  (05:00 WAT), via `call_app_endpoint`.
- **Needs your explicit yes before `db push`** (no staging DB).

### Phase 2 — Schedule maths (pure functions + tests)
- `lib/tasks/recurrence.ts`: next due dates for a series, creation date per
  occurrence, month-end clamping, quarter ends, weekend/holiday shift, pause
  windows, assignee-on-date lookup.
- `lib/tasks/__tests__/recurrence.test.ts` (runs under `test:task-scoring`):
  Feb 28/29, 31st in 30-day months, quarter end on a Sunday, holiday runs,
  pause covering a due date, end date mid-month.
- This is where the bugs would hide, so it is built and tested before anything
  calls it.

### Phase 3 — Generator cron
- `app/api/cron/tasks/generate-recurring/route.ts` (`isCronRequest`, like
  expire-overdue). For each active series: create every occurrence whose
  creation date has arrived and whose due date is today or later, insert with
  `ON CONFLICT DO NOTHING`.
- Occurrences whose due date already passed (cron was down) are **not**
  back-created — logged instead (open decision D).
- Same insert path as `POST /api/tasks` — the scope checks and insert payload
  move into a shared `lib/tasks/create.ts` rather than being copied.
- `expire-overdue`: skip tasks whose series is paused.

### Phase 4 — Series API (zod on every route)
- `POST /api/task-series` — create (one series per assignee); creates the first
  task straight away if its window is already open.
- `PATCH /api/task-series/[id]` — edit future, and the actions:
  `reassign {assigned_to, effective_from, move_open}`,
  `pause {from, until?}` → returns the heads-up list before confirm,
  `resume`, `end {reason}`.
- `GET /api/task-series` — list, scoped like `GET /api/tasks`.
- Audit log on every action; notifications use the existing `task_updated`
  type (a new type needs four registrations — avoided).

### Phase 5 — Scoring
- `computeWeightedTaskScore`: group by `series_id` → one entry with the series
  weight, earned = weight × average(rating/5) of its scorable tasks
  (failed = 0; cancelled/reassigned/unresolved left out as today).
- Add `series_id` to the selects of every consumer: `lib/performance/scoring.ts`,
  `lib/reports/weekly-task-summary.ts`, PMS pages, task management pages.
- Extend `lib/tasks/__tests__` scoring tests with the Ada example.

### Phase 6 — UI
- `TaskFormDialog.tsx` (shared by admin, dept and project boards): **Repeat**
  select, frequency fields, Starts / Ends, and a preview of the next three due
  dates instead of a single due-date picker.
- "Repeats monthly" badge on task rows, opening a **series sheet**: schedule,
  assignee history, upcoming dates, past tasks with status, and the
  Reassign / Pause / Resume / End actions.
- **Bulk approve**: select submitted tasks from one series, give one rating.
- "Recurring" filter on the existing tasks `DataTablePage` — no new page, so no
  sidebar change.

## Decisions taken

- **A.** A weekend/holiday due date moves to the previous working day, unless that leaves
  its month (then the next working day).
- **B.** A daily series notifies a person's first repeat only, and skips the due-today
  reminder; every other frequency notifies each repeat.
- **C.** Weekly defaults to Friday.
- **D.** A repeat whose deadline passed while the generator was down is not created late.
- **E.** A series is managed by admins, the lead of its department, or whoever set it up.
- The schedule of an existing series is fixed; a different schedule is a new series.
