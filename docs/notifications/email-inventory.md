# Every email the system sends

Checked against the code and the live `cron.job` table on 3 Nov 2026. All mail goes through
Resend, from either `lib/notifications/email-gateway.ts` (the Next.js app) or
`supabase/functions/_shared/email.ts` (Edge Functions).

**How often** says what triggers a send. **Per event** means one email each time the thing
happens. That is where floods come from when someone works through a queue.

## Scheduled (pg_cron)

| Email (subject) | Who gets it | How often | Source |
| --- | --- | --- | --- |
| Attendance Appeals Decided (summary) | The employee only | Every 15 min, only if something was decided | `app/api/cron/attendance/appeal-digest` (**new**) |
| Attendance Appeals Summary | Each Department Lead (one per department led); Admin & HR lead | Daily 08:30 WAT, skipped when empty | `app/api/cron/attendance/appeal-lead-summary` (**new**) |
| Daily Attendance Report — _date_ | Report recipients | Checked every 15 min, sends once a day | Edge `send-attendance-daily-report` |
| Clock-in Device Offline — _date_ | Device-alert recipients + ICT | Checked every 30 min on weekdays, at most once a day per kind | `app/api/cron/attendance/device-health` |
| Attendance times restored (_n_) | Security alert address (see below) | Daily 22:00 UTC, only when it corrected something | `app/api/cron/attendance/device-reconcile` (not in `cron.job`; Vercel cron) |
| Leave approval SLA reminder | Current approver, **one summary each** | Daily 08:00 UTC | `app/api/hr/leave/sla/reminders` |
| Action required: overdue leave approvals | Admin & HR lead, **one summary** | Daily 08:00 UTC, for as long as anything is overdue | same |
| Your leave request lapsed / A leave request lapsed awaiting your action | Employee + the approver it was stuck with | Same run, once per lapsed request (one-off) | same |
| Task due / Overdue — act by / still waiting for your rating | Assignee / reviewer | Weekdays 07:00 UTC, **one email per task** | `app/api/cron/tasks/reminders` → `lib/tasks/mailer.ts` |
| Task past deadline escalated / Task recorded as failed | Assignee, lead | When `app/api/cron/tasks/expire-overdue` runs. **No `cron.job` row calls it today** | `lib/tasks/mailer.ts` |
| Mailbox Almost Full — _address_ | Mailbox owner + ICT | Daily 07:15 UTC | `app/api/cron/mailboxes/quota-alerts` |
| Starlink Bill Due / Starlink Payment Failed | Starlink alert recipients | Hourly sync, once per bill or failure | `app/api/cron/starlink/billing-sync` |
| Payment Due Reminder / Payment Overdue Alert | Payment creator | Daily 08:00 UTC, once per payment per state | Edge `check-payment-status` |
| Meeting Reminder Failed to Send | ICT / admins | Every 10 min, only on failure | `app/api/cron/reminders/health` |
| Meeting reminders | Attendees | Every 5 min, from reminder schedules | `process_reminder_schedules()` → Edge `send-meeting-reminder` |
| Knowledge Sharing Session Scheduled | Next week's KSS department | Mondays | `process_kss_heads_up()` → Edge `send-kss-heads-up` |
| Weekly report / action tracker digest | Schedule recipients | Every 15 min check, per schedule | `process_digest_schedules()` → Edge `send-weekly-report` |
| Meeting Documents — _meeting_ | Meeting audience | Every 20 min, 11:00–14:00 UTC on weekdays, when new minutes land | Edge `sync-meeting-artifacts` |
| Happy Birthday from ACOB Lighting! | The birthday person | Daily 23:00 UTC | Edge `send-birthday-emails` |
| Weekly birthday list | Birthday Manager recipients | Monday 00:00 WAT (+07:00 retry) | `app/api/cron/hr/birthday-reminder` |
| Database changed outside the ERP | Security alert address (see below) | Every 5 min (**job is currently inactive**) | `app/api/cron/security/db-changes` |

## Triggered by something someone does

| Area | Emails | Batched? | Source |
| --- | --- | --- | --- |
| Attendance appeals | New appeals and decisions, to leads | **No email**; in the 08:30 daily summary | `sendAppealLeadDailySummary` in `lib/hr/attendance-notify.ts` |
| Attendance appeals | Decisions, to the employee | **Summary every 15 min** (was per appeal) | `sendAppealDecisionDigest`, same file |
| Leave | Approval required, ready for approval, approved, rejected | Per request, per stage | `lib/hr/leave-workflow.ts`, `lib/hr/leave-routing.ts` → `lib/leave-mailer.ts` |
| Tasks | Task assigned, awaiting your review, deadline changed | Per task | `lib/tasks/mailer.ts` |
| Requisitions / petty cash | Each stage action and payment | Per action | `lib/requisitions/notify.ts` |
| Help desk | Ticket created, assigned, updated | Per ticket action | `lib/help-desk/mailer.ts` |
| Correspondence | _Type_ Correspondence _decision_ — _ref_ | Per decision | `lib/correspondence/mailer.ts` |
| Payroll | Payslip | Per employee (bulk send is still one each, by design) | `lib/hr/payslip-mailer.ts` |
| Exit | Exit notification (single or bulk) | Per exit, or one for a bulk exit | `lib/hr/exit-mailer.ts` |
| Onboarding | Onboarding Form Submitted | Per submission | `app/api/public/onboarding-submit` |
| Onboarding | Welcome / company email setup, ICT copy | On approval or credential dispatch | `lib/employees/mailbox-welcome.ts`, `app/api/admin/approve-user` |
| Security | Password changed | Per change | `app/api/auth/change-password` |
| Security | Your approval PIN reset code | Per request | `lib/approval-signing/server.ts` |
| Assets | Asset assigned / returned / issue raised / resolved | Per change, from DB triggers | `handle_asset_return`, `handle_new_asset_issue`, `handle_asset_issue_resolution` → Edge `send-email-notification` |
| Communications | Broadcast mail from the Communications page | Per send | Edge `send-communications-mail` |

## Security alert address

Both security emails go to one address: `ORG_SECURITY_ALERT_EMAIL` in `lib/org-config.ts`,
which is the `SECURITY_ALERT_EMAIL` environment variable if set, otherwise
`i.chibuikem@org.acoblighting.com`.

## Still one email per item (candidates for a summary)

- **Task reminders** (`app/api/cron/tasks/reminders`): one email per task each morning, so
  someone with several tasks due gets several.
- **Leave approval required**: one per request. Usually low volume, but it bunches up around
  holidays.

## Inactive or retired

- `process-notifications-every-minute` and `process-push-every-minute` are inactive.
  `app-db-change-alerts` is inactive too.
- `notifyAttendanceMail` (one email per appeal decision) and `notifyAppealSubmittedMail` (one
  email per new appeal) were removed in favour of the summaries.
