import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { UiErrorsContent, type UiErrorRow } from "./ui-errors-content"

import { logger } from "@/lib/logger"
import { getRequestScope } from "@/lib/admin/api-scope"
import { canAccessAdminSection } from "@/lib/admin/rbac"
import { notFound } from "next/navigation"

const log = logger("dev-ui-errors")

type UiAuditLogRow = {
  id: string
  created_at: string
  error_details: string | null
  metadata: Record<string, unknown> | null
  user_id: string | null
}

type UiErrorUserRow = {
  id: string
  first_name?: string | null
  last_name?: string | null
  company_email?: string | null
}

type ErrorMonitorStatusClient = {
  rpc: (
    fn: "get_error_monitor_collector_status",
    args: Record<string, never>
  ) => Promise<{ data: boolean | null; error: { message: string } | null }>
}

function readMetaString(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key]
  return typeof value === "string" ? value : ""
}

export default async function DevUiErrorsPage() {
  const scope = await getRequestScope()
  if (!scope?.isAdminLike || !canAccessAdminSection(scope, "dev")) notFound()
  const supabase = await createClient()
  const { data: collectorConfigured } = await (supabase as unknown as ErrorMonitorStatusClient).rpc(
    "get_error_monitor_collector_status",
    {}
  )
  const dataClient = getServiceRoleClientOrFallback(supabase)
  const { data: alertSetting } = await dataClient
    .from("system_settings")
    .select("value")
    .eq("key", `error_monitor_alert_${scope.userId}`)
    .maybeSingle()
  const { data: collectorSetting } = await dataClient
    .from("system_settings")
    .select("value")
    .eq("key", "error_monitor_collector")
    .maybeSingle()

  const { data: logs, error } = await dataClient
    .from("audit_logs")
    .select("id, created_at, error_details, metadata, user_id")
    .in("action", ["client_error", "system_error"])
    .in("entity_type", ["ui_runtime", "system_runtime"])
    .order("created_at", { ascending: false })
    .limit(500)
    .returns<UiAuditLogRow[]>()

  if (error) {
    log.error("Error loading UI telemetry logs:", error)
  }

  const userIds = Array.from(new Set((logs || []).map((entry) => entry.user_id).filter(Boolean)))
  let usersMap = new Map<string, UiErrorUserRow>()

  if (userIds.length > 0) {
    const { data: users } = await dataClient
      .from("profiles")
      .select("id, first_name, last_name, company_email")
      .in("id", userIds)
      .returns<UiErrorUserRow[]>()
    usersMap = new Map((users || []).map((user) => [user.id, user]))
  }

  const rows: UiErrorRow[] = (logs || []).map((entry) => {
    const meta = entry.metadata
    const source = readMetaString(meta, "source") || "unknown"
    const route = readMetaString(meta, "route") || readMetaString(meta, "href")
    const user = entry.user_id ? usersMap.get(entry.user_id) : null
    const userName =
      user?.first_name && user?.last_name
        ? `${user.first_name} ${user.last_name}`
        : user?.company_email || (entry.user_id ? "Authenticated User" : "Anonymous")

    return {
      id: entry.id,
      created_at: entry.created_at,
      message: String(entry.error_details || "Unknown error"),
      source,
      route,
      user_name: userName,
      stack: readMetaString(meta, "stack"),
      context: meta?.context && typeof meta.context === "object" ? meta.context : {},
      resolved: meta?.resolved === true,
    }
  })

  const stats = {
    total: rows.length,
    last24h: rows.filter((r) => new Date(r.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000).length,
    boundaries: rows.filter((r) => r.source.includes("error_boundary")).length,
    unresolved: rows.filter((r) => !r.resolved).length,
  }

  return (
    <UiErrorsContent
      rows={rows}
      stats={stats}
      error={error}
      alertsEnabled={alertSetting?.value?.enabled === true}
      collectorLastSuccess={
        typeof collectorSetting?.value?.last_success === "string" ? collectorSetting.value.last_success : null
      }
      platformConfigured={collectorConfigured === true}
    />
  )
}
