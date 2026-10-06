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

1. Deploy the application changes and the accompanying database migration.
2. In Supabase Dashboard → Account → Access Tokens, create a **scoped** token
   limited to this project with the read permission for Analytics Logs. Never use
   a classic account token or the project's service-role key for this purpose.
3. In Developer → Error Monitor, click **Connect Supabase logs**, paste the token
   once, and click **Save securely**. The application sends it only to the server,
   which stores it encrypted in Supabase Vault; it is never returned to a browser.
4. Supabase `pg_cron` then invokes the existing Vault-backed application scheduler
   every 15 minutes. Check **last succeeded** in Error Monitor after the first run.

No hosting variables, GitHub Actions secrets, Log Drains, or external scheduler are
required. The existing `app_base_url` and `app_cron_secret` Vault secrets are reused
by the repository-wide scheduler. Collection is delayed and cannot recover logs
that have already expired under Supabase retention or usage limits.

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
