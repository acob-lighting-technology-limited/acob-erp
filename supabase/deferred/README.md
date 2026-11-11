# Deferred migrations

SQL kept out of `supabase/migrations/` on purpose. A migration there is picked up by
`supabase db push`; if it is older than the latest applied version it blocks every push
(`DbPushMissingRemoteError`) unless someone passes `--include-all`.

## help_desk_standalone_destructive_cleanup.sql

Was `20261104110000_help_desk_standalone_destructive_cleanup`. Drops the legacy help-desk
columns (`request_type`, `approval_required`, `current_approval_stage`, `category_id`,
`csat_rating`, `csat_feedback`, `task_id`, `pivoted_to_procurement`, `procurement_reason`),
the `help_desk_approvals` table, and tightens the status check.

**Do not run it yet.** The app still reads some of those columns: `csat_rating` and
`csat_feedback` (help-desk list and ticket detail), `current_approval_stage` (admin help
desk) and `request_type` (tickets route, categories). Dropping them breaks those pages.

When the code no longer reads any of them:
1. Confirm with `grep` that nothing under `app/`, `lib/`, `components/` or `supabase/functions/` does.
2. Copy the file back into `supabase/migrations/` with a **new timestamp later than the latest
   applied migration**, then `db push` it.

State at the time it was deferred (11 Nov 2026): the forward-compatible columns were live, the
legacy columns were still present, and `help_desk_tickets` and `help_desk_approvals` had 0 rows.
