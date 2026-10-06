# Error Monitor

Developer → Error Monitor (`/admin/dev/ui-errors`) now includes browser crashes,
failed same-origin API requests, failed Supabase HTTP requests, server exceptions,
and errors written through the shared server logger. Expand a row for its reference,
stack and context. Repeated errors from the same user, source and route are grouped;
mark resolved or reopen applies to the displayed group's events. Counts are limited
to the latest 500 events. The screen refreshes every minute
while visible and shows the latest 500 events, not an all-time total.

## Supabase Free configuration

This implementation does not use paid Log Drains. A server collector queries
Supabase's Management API with narrow error filters. It uses overlapping windows,
deterministic event IDs, checkpoints and pagination to avoid importing duplicates
or skipping a full batch. Collection is delayed, and cannot recover logs already
expired by Supabase's retention or usage limits.

1. Deploy the application changes.
2. Set `SUPABASE_LOGS_ACCESS_TOKEN` in the hosting environment to a management
   token restricted to this project with `analytics_logs_read` permission. Never
   prefix it with `NEXT_PUBLIC_`, commit it, or use the project's service-role key
   as a management token. Existing `SUPABASE_SERVICE_ROLE_KEY` is needed for storage.
3. Set a strong `CRON_SECRET` in the hosting environment.
4. In GitHub Actions, add the same `CRON_SECRET` as a repository secret; set
   repository variables `ERROR_MONITOR_APP_URL=https://matrix.acoblighting.com`
   and `ERROR_MONITOR_ENABLED=true`. The workflow must be on the default branch
   for scheduled runs. Run **Collect Supabase errors** manually to verify first.
5. Check the workflow response and the monitor's last successful collection time.
   Until the token and schedule are configured, platform logs are not collected.

The included GitHub Actions workflow runs every 15 minutes when enabled. Actions
can delay scheduled jobs; this is not a guaranteed delivery interval. An existing
external scheduler can instead send `GET /api/cron/collect-errors` with
`Authorization: Bearer <CRON_SECRET>`. It must use HTTPS. Do not enable two schedules.
No Supabase subscription upgrade or new observability service is required; normal
hosting, Actions and Supabase resource quotas still apply.

## Alerts and retention

Click **Notify me** to subscribe your own developer account. The collector sends
an in-app notification for new unresolved errors, then advances that account's
checkpoint. Repeated refreshes do not send alerts. It does not email other staff.
App alerts and cleanup also run without a management token, if the schedule and
cron secret are configured. Only `system_error` / `system_runtime` telemetry older
than 30 days is removed. Ordinary business audit records are retained unchanged.
Database storage is shared with business data; monitor it after downgrading.

## Coverage and privacy

- Request capture reports status, method, endpoint and request reference without
  consuming response bodies or changing the operation's result. Intentional
  cancellation, external requests and telemetry/audit requests are excluded.
- Supabase errors returned as non-success HTTP responses are captured even when
  application code handles them instead of throwing. RLS returning zero rows,
  `200 OK` responses that contain an application-level failure, custom XHR uploads,
  swallowed local errors and client validation need explicit action reporting:
  `reportClientError({ source: "action.error", message: "Upload failed", context: { code: "UPLOAD_FAILED" } })`.
- Server request exceptions are captured by Next instrumentation. The shared
  logger also reports handled server errors. Script/startup errors outside a Next
  request stay in hosting/terminal logs; Edge Function logs arrive through collection.
- Client reports are untrusted diagnostics. Identity is derived from the server
  session, never from a supplied user ID. Developer access is required to view,
  resolve or subscribe to logs.
- No request bodies, headers, query strings, cookies or arbitrary context objects
  are persisted. Known secret patterns and failing-row contents are redacted.
  Free-text error messages can still contain unexpected personal data: avoid
  embedding user payloads or SQL statements in logged messages.
- A complete database outage prevents database-backed recording. Hosting logs
  remain the fallback. Browser reports are best effort and can be lost offline,
  on page closure, or when rate limits apply. This is not a guarantee of every failure.

## Validation

Run `npx tsx --test lib/telemetry/__tests__/*.test.ts`,
`npx eslint . --ext .ts,.tsx` and `npx tsc --noEmit`.
No schema migration is required: telemetry uses existing `audit_logs`,
`system_settings` and the notification RPC.

Official references:
[Management API log queries](https://supabase.com/docs/guides/observability/advanced-log-filtering),
[log endpoint](https://supabase.com/docs/reference/api/v1-get-project-logs),
[usage limits](https://supabase.com/docs/guides/platform/manage-your-usage/logs-query).
