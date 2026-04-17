import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { requireAdminSectionAccess } from "@/lib/admin/rbac"
import { SecurityEventsContent, type AuditLogRow } from "./security-events-content"

function isSecurityEvent(log: AuditLogRow): boolean {
  const text =
    `${log.action || ""} ${log.operation || ""} ${log.entity_type || ""} ${log.status || ""} ` +
    `${JSON.stringify(log.metadata || {})} ${JSON.stringify(log.old_values || {})} ${JSON.stringify(log.new_values || {})}`.toLowerCase()
  const roleChangeSignal =
    text.includes("role") ||
    text.includes("super_admin") ||
    text.includes("developer") ||
    text.includes("is_admin") ||
    text.includes("admin_domains") ||
    text.includes("lead_departments")

  return (
    text.includes("auth") ||
    text.includes("permission_denied") ||
    text.includes("forbidden") ||
    text.includes("unauthorized") ||
    text.includes("security") ||
    text.includes("suspicious") ||
    text.includes("failed") ||
    text.includes("invalid") ||
    text.includes("blocked") ||
    text.includes("escalat") ||
    roleChangeSignal
  )
}

export const dynamic = "force-dynamic"

export default async function DevSecurityEventsPage() {
  await requireAdminSectionAccess("dev")

  const supabase = await createClient()
  const dataClient = getServiceRoleClientOrFallback(supabase)
  const { data, error } = await dataClient
    .from("audit_logs")
    .select(
      "id, action, operation, entity_type, entity_id, user_id, status, metadata, old_values, new_values, created_at"
    )
    .returns<AuditLogRow[]>()
    .order("created_at", { ascending: false })
    .limit(1200)

  const rows = (data || []).filter(isSecurityEvent)

  return <SecurityEventsContent rows={rows} error={error?.message || null} />
}
