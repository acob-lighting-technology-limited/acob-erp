import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { requireAdminSectionAccess } from "@/lib/admin/rbac"
import { RoleEscalationsContent, type AuditLogRow } from "./role-escalations-content"

function isEscalation(log: AuditLogRow): boolean {
  const text =
    `${log.action || ""} ${log.operation || ""} ${log.entity_type || ""} ${JSON.stringify(log.new_values || {})} ${JSON.stringify(log.old_values || {})} ${JSON.stringify(log.metadata || {})}`.toLowerCase()
  const touchesRole = text.includes("role")
  const elevated = ["admin", "super_admin", "developer", "admin_domains", "department_lead"].some(
    (roleName) => text.includes(`\"${roleName}\"`) || text.includes(roleName)
  )
  return touchesRole && elevated
}

export const dynamic = "force-dynamic"

export default async function DevRoleEscalationsPage() {
  await requireAdminSectionAccess("dev")

  const supabase = await createClient()
  const dataClient = getServiceRoleClientOrFallback(supabase)
  const { data, error } = await dataClient
    .from("audit_logs")
    .select("id, action, operation, entity_type, entity_id, user_id, old_values, new_values, metadata, created_at")
    .returns<AuditLogRow[]>()
    .order("created_at", { ascending: false })
    .limit(1200)

  const rows = (data || []).filter(isEscalation)

  return <RoleEscalationsContent rows={rows} error={error?.message || null} />
}
