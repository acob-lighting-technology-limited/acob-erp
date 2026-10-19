import { NextRequest, NextResponse } from "next/server"
import { isCronRequest } from "@/lib/security/bearer-auth"
import { getServiceClient } from "@/lib/supabase/admin"
import { reconcileAttendanceWithLedger } from "@/lib/hr/attendance-reconcile"
import { sendPendingDbChangeAlerts } from "@/lib/security/db-change-alerts"
import { sendNotificationEmailWithRetry } from "@/lib/notifications/email-gateway"
import { renderSystemAlertEmail } from "@/lib/email-templates/system-alert"
import { ORG_EMAIL_SENDERS, ORG_MAIL_ROUTING, ORG_SECURITY_ALERT_EMAIL } from "@/lib/org-config"
import { formatWATDate, toLocalISODate } from "@/lib/utils/date"
import { logger } from "@/lib/logger"

const log = logger("cron-attendance-device-reconcile")
export const dynamic = "force-dynamic"
export const maxDuration = 300

/** Days looked back on a normal nightly run. */
const DEFAULT_LOOKBACK_DAYS = 7
const EMAIL_ROW_LIMIT = 200

/**
 * Nightly: clock times that do not match what the ERP recorded are put back,
 * and the corrections are emailed. Scheduled from Vercel (vercel.json), not
 * pg_cron, so a database login cannot switch it off.
 *
 * ?since=YYYY-MM-DD&until=YYYY-MM-DD widen the window for a one-off backfill;
 * ?dry=1 reports without changing anything or sending email.
 */
export async function GET(request: NextRequest) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = getServiceClient()
  if (!supabase) return NextResponse.json({ error: "Missing configuration" }, { status: 500 })

  const params = request.nextUrl.searchParams
  const isDate = (value: string | null): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
  const now = new Date()
  const since = isDate(params.get("since"))
    ? params.get("since")!
    : toLocalISODate(new Date(now.getTime() - DEFAULT_LOOKBACK_DAYS * 86_400_000))
  const until = isDate(params.get("until")) ? params.get("until")! : toLocalISODate(now)
  const apply = params.get("dry") !== "1"

  try {
    const result = await reconcileAttendanceWithLedger(supabase, { since, until, apply })

    // Also catch up any outside-the-ERP alerts the trigger and pg_cron did not deliver.
    let alertsFlushed = 0
    try {
      alertsFlushed = (await sendPendingDbChangeAlerts(supabase)).emailed
    } catch (error) {
      log.error({ err: String(error) }, "DB change alert flush failed")
    }

    const userIds = Array.from(
      new Set([...result.corrections.map((c) => c.userId), ...result.unverified.map((u) => u.userId)])
    )
    const names = new Map<string, string>()
    if (userIds.length > 0) {
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", userIds)
      for (const p of (data ?? []) as Array<{ id: string; full_name: string | null }>) {
        names.set(p.id, p.full_name ?? p.id)
      }
    }
    const nameOf = (id: string) => names.get(id) ?? id

    const corrections = result.corrections.map((c) => ({ ...c, name: nameOf(c.userId) }))

    if (apply && (corrections.length > 0 || result.failed > 0)) {
      const html = renderSystemAlertEmail({
        title: "Attendance times restored to device records",
        paragraphs: [
          `${corrections.length} clock time${corrections.length === 1 ? "" : "s"} between ${formatWATDate(since)} and ${formatWATDate(until)} did not match what the device or the ERP recorded and ${corrections.length === 1 ? "has" : "have"} been put back.`,
          ...(result.failed > 0
            ? [`${result.failed} record(s) could not be updated and will be retried tomorrow.`]
            : []),
          "Nothing was shown to the staff member; statuses were re-derived from the restored times.",
        ],
        tables: [
          {
            headers: ["Staff", "Date", "Field", "Was", "Restored to"],
            rows: corrections
              .slice(0, EMAIL_ROW_LIMIT)
              .map((c) => [
                c.name,
                c.date,
                c.field === "clock_in" ? "Clock in" : "Clock out",
                c.was ?? "-",
                c.restored ?? "(none recorded)",
              ]),
          },
        ],
      })
      const sent = await sendNotificationEmailWithRetry({
        from: ORG_EMAIL_SENDERS.system,
        ...ORG_MAIL_ROUTING.Security,
        to: [ORG_SECURITY_ALERT_EMAIL],
        subject: `Attendance times restored (${corrections.length})`,
        html,
      })
      if (!sent.sent) log.error({ reason: sent.reason }, "Reconciliation email failed")
    }

    if (corrections.length > 0) {
      log.warn({ corrections: corrections.length, apply, since, until }, "Attendance times differed from ledger")
    }

    return NextResponse.json({
      data: {
        since,
        until,
        applied: apply,
        checked: result.checked,
        failed: result.failed,
        alertsFlushed,
        corrections,
        unverifiedCount: result.unverified.length,
        unverified: result.unverified.slice(0, 50).map((u) => ({ ...u, name: nameOf(u.userId) })),
      },
    })
  } catch (error) {
    log.error({ err: String(error) }, "Attendance reconciliation failed")
    return NextResponse.json({ error: "Attendance reconciliation failed" }, { status: 500 })
  }
}
