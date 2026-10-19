import type { SupabaseClient } from "@supabase/supabase-js"
import { sendNotificationEmailWithRetry } from "@/lib/notifications/email-gateway"
import { renderSystemAlertEmail } from "@/lib/email-templates/system-alert"
import { ORG_EMAIL_SENDERS, ORG_MAIL_ROUTING, ORG_SECURITY_ALERT_EMAIL } from "@/lib/org-config"
import { formatWATDateTime } from "@/lib/utils/date"
import { logger } from "@/lib/logger"

const log = logger("security-db-change-alerts")

/** Rows per email; a bulk script produces several emails rather than one huge one. */
const BATCH_SIZE = 200
/** Upper bound per run so a runaway script cannot make one invocation time out. */
const MAX_BATCHES = 5
const VALUE_MAX_CHARS = 80

interface DbChangeRow {
  id: number
  occurred_at: string
  table_name: string
  operation: string
  row_id: string | null
  subject_user_id: string | null
  db_user: string
  session_user_name: string
  client_addr: string | null
  application_name: string | null
  changed_columns: string[] | null
  old_row: Record<string, unknown> | null
  new_row: Record<string, unknown> | null
  detail: string | null
}

function show(value: unknown): string {
  if (value === null || value === undefined) return "∅"
  const text = typeof value === "string" ? value : JSON.stringify(value)
  return text.length > VALUE_MAX_CHARS ? `${text.slice(0, VALUE_MAX_CHARS)}…` : text
}

/** "clock_in: 08:49:49 → 08:19:49" lines for an update; the key fields for an insert or delete. */
function describeChange(row: DbChangeRow): string {
  if (row.operation.startsWith("DDL")) return row.detail ?? ""
  if (row.operation === "UPDATE") {
    return (row.changed_columns ?? [])
      .filter((col) => col !== "updated_at")
      .map((col) => `${col}: ${show(row.old_row?.[col])} → ${show(row.new_row?.[col])}`)
      .join("\n")
  }
  const source = row.operation === "INSERT" ? row.new_row : row.old_row
  const keys = Object.keys(source ?? {}).filter(
    (key) => !["id", "created_at", "updated_at"].includes(key) && source?.[key] !== null
  )
  return keys
    .slice(0, 10)
    .map((key) => `${key}: ${show(source?.[key])}`)
    .join("\n")
}

async function loadNames(supabase: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  if (ids.length === 0) return names
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids)
  for (const profile of (data ?? []) as Array<{ id: string; full_name: string | null }>) {
    names.set(profile.id, profile.full_name ?? profile.id)
  }
  return names
}

/**
 * Emails every database change logged as made outside the ERP that has not
 * been emailed yet. Rows are claimed atomically before sending and handed back
 * if the send fails, so nothing is skipped and nothing is sent twice.
 */
export async function sendPendingDbChangeAlerts(supabase: SupabaseClient): Promise<{ emailed: number }> {
  let emailed = 0

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const { data, error } = await supabase.rpc("claim_db_change_alerts", { p_limit: BATCH_SIZE })
    if (error) throw error
    const rows = (data ?? []) as DbChangeRow[]
    if (rows.length === 0) break

    const names = await loadNames(
      supabase,
      Array.from(new Set(rows.map((row) => row.subject_user_id).filter((id): id is string => Boolean(id))))
    )

    const logins = Array.from(
      new Set(
        rows.map(
          (row) => `${row.session_user_name} from ${row.client_addr ?? "local"} (${row.application_name || "?"})`
        )
      )
    )
    const tables = Array.from(new Set(rows.map((row) => row.table_name)))
    const html = renderSystemAlertEmail({
      title: "Database changed outside the ERP",
      paragraphs: [
        `${rows.length} change${rows.length === 1 ? " was" : "s were"} made directly on the database, not through the ERP, to: ${tables.join(", ")}.`,
        `Connection: ${logins.join("; ")}.`,
        "If you did not make these changes, rotate the database password and check who has access to the Supabase project. The nightly attendance check puts clock times back to what the device recorded.",
      ],
      tables: [
        {
          headers: ["When (WAT)", "Table", "Action", "Staff", "What changed"],
          rows: rows.map((row) => [
            formatWATDateTime(row.occurred_at, { second: "2-digit" }),
            row.table_name,
            row.operation,
            row.subject_user_id ? (names.get(row.subject_user_id) ?? row.subject_user_id) : "-",
            describeChange(row),
          ]),
        },
      ],
    })

    const result = await sendNotificationEmailWithRetry({
      from: ORG_EMAIL_SENDERS.system,
      ...ORG_MAIL_ROUTING.Security,
      to: [ORG_SECURITY_ALERT_EMAIL],
      subject: `Database changed outside the ERP (${rows.length})`,
      html,
    })

    if (!result.sent) {
      log.error({ reason: result.reason, count: rows.length }, "DB change alert email failed; releasing rows")
      const { error: releaseError } = await supabase.rpc("release_db_change_alerts", {
        p_ids: rows.map((row) => row.id),
      })
      if (releaseError) log.error({ err: releaseError.message }, "Failed to release DB change alert rows")
      break
    }

    emailed += rows.length
    if (rows.length < BATCH_SIZE) break
  }

  if (emailed > 0) log.warn({ emailed }, "Database changes outside the ERP reported")
  return { emailed }
}
