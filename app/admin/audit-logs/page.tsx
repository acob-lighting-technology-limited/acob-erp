import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminAuditLogsContent, type AuditLog, type UserProfile } from "./admin-audit-logs-content"
import type { EmployeeMember as employeeMember } from "./types"
import { getDepartmentScope, resolveAdminScope } from "@/lib/admin/rbac"
import { normalizeAuditAction } from "@/lib/audit/core"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"

import { logger } from "@/lib/logger"

const log = logger("audit-logs")

type AuditLogsData =
  | { kind: "redirect"; redirect: string }
  | {
      kind: "data"
      logs: AuditLog[]
      totalCount: number
      employee: employeeMember[]
      departments: string[]
      userProfile: UserProfile
    }

async function getAuditLogsData(): Promise<AuditLogsData> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { kind: "redirect", redirect: "/auth/login" }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scope = await resolveAdminScope(supabase as any, user.id)
  if (!scope) {
    return { kind: "redirect", redirect: "/dashboard" }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dataClient = getServiceRoleClientOrFallback(supabase as any)
  const departmentScope = getDepartmentScope(scope, "general")

  const userProfile: UserProfile = {
    role: scope.role,
    lead_departments: scope.leadDepartments,
    managed_departments: scope.managedDepartments,
  }

  // Single enriched RPC call (replaces 13 sequential queries)
  const { data: rpcRows, error: rpcError } = await dataClient.rpc("get_audit_logs_enriched", {
    p_limit: 500,
    p_offset: 0,
    p_hidden_actions: ["sync", "migrate", "update_schema", "migration"],
    p_department_filter: departmentScope ?? null,
  })

  if (rpcError) {
    log.error("get_audit_logs_enriched RPC error:", rpcError)
    return { kind: "data", logs: [], totalCount: 0, employee: [], departments: [], userProfile }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (rpcRows ?? []) as any[]
  const totalCount = rows.length > 0 ? Number(rows[0].total_count ?? rows.length) : 0

  // Map RPC rows → AuditLog shape expected by the client component
  const logs: AuditLog[] = rows.map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (row: any) => {
      const rawAction = row.action || "update"
      const normalizedAction = normalizeAuditAction(rawAction).action
      const metadata = {
        ...(row.metadata || {}),
        ...(row.metadata?.event ? {} : rawAction !== normalizedAction ? { event: rawAction } : {}),
      }

      return {
        id: row.id,
        user_id: row.user_id,
        action: normalizedAction,
        entity_type: (row.entity_type || "unknown").toLowerCase(),
        entity_id: row.entity_id ?? null,
        old_values: row.old_values ?? {},
        new_values: row.new_values ?? {},
        metadata,
        created_at: row.created_at,
        department: row.department ?? null,
        changed_fields: row.changed_fields ?? [],
        user: row.user_data ?? null,
        target_user: row.target_user_data ?? null,
        task_info: row.task_info ?? null,
        asset_info: row.asset_info ?? null,
        payment_info: row.payment_info ?? null,
        document_info: row.document_info ?? null,
        department_info: row.department_info ?? null,
        category_info: row.category_info ?? null,
        leave_request_info: row.leave_request_info ?? null,
        device_info: row.device_info ?? null,
      }
    }
  )

  // Employees for filter dropdown
  let employeeQuery = dataClient
    .from("profiles")
    .select("id, first_name, last_name, department")
    .order("last_name", { ascending: true })
  if (departmentScope) {
    employeeQuery =
      departmentScope.length > 0 ? employeeQuery.in("department", departmentScope) : employeeQuery.eq("id", "__none__")
  }
  const { data: employeeData } = await employeeQuery
  const employee = (employeeData ?? []) as employeeMember[]

  // Departments
  let departments: string[]
  if (departmentScope) {
    departments = [...departmentScope].sort()
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const employeeDepartments = employee.map((s) => s.department).filter(Boolean)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logDepartments = rows.map((r: any) => r.department).filter(Boolean)
    departments = Array.from(new Set([...employeeDepartments, ...logDepartments])).sort() as string[]
  }

  return { kind: "data", logs, totalCount, employee, departments, userProfile }
}

export default async function AuditLogsPage() {
  const data = await getAuditLogsData()

  if (data.kind === "redirect") {
    redirect(data.redirect)
  }

  const { logs, totalCount, employee, departments, userProfile } = data

  return (
    <AdminAuditLogsContent
      initialLogs={logs}
      initialTotalCount={totalCount}
      initialemployee={employee}
      initialDepartments={departments}
      userProfile={userProfile}
    />
  )
}
