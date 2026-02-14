import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminAuditLogsContent, type AuditLog, type employeeMember, type UserProfile } from "./admin-audit-logs-content"

async function getAuditLogsData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  // Get user profile
  const { data: profile } = await supabase.from("profiles").select("role, lead_departments").eq("id", user.id).single()

  if (!profile || !["super_admin", "admin", "lead"].includes(profile.role)) {
    return { redirect: "/dashboard" as const }
  }

  const userProfile: UserProfile = {
    role: profile.role,
    lead_departments: profile.lead_departments,
  }

  // Fetch audit logs
  const { data: logsData, error: logsError } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500)

  if (logsError) {
    console.error("Audit logs error:", logsError)
    return { logs: [], employee: [], departments: [], userProfile }
  }

  let logs: AuditLog[] = []
  let employee: employeeMember[] = []
  let departments: string[] = []

  if (logsData && logsData.length > 0) {
    // Get unique user IDs from logs
    const userIds = Array.from(new Set(logsData.map((log) => log.user_id).filter(Boolean)))

    // Fetch user profiles for all unique user IDs
    const { data: usersData } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, company_email")
      .in("id", userIds)

    const usersMap = new Map(usersData?.map((u) => [u.id, u]))

    // Add user info to logs and map database columns to UI interface
    logs = logsData.map((log: any) => {
      // Prefer new dedicated columns, fall back to metadata for backward compatibility
      // Handle potential JSON string values and empty objects
      let new_values = log.new_values
      let old_values = log.old_values

      // Parse if string (in case of serialization issues)
      if (typeof new_values === "string") {
        try {
          new_values = JSON.parse(new_values)
        } catch {
          new_values = null
        }
      }
      if (typeof old_values === "string") {
        try {
          old_values = JSON.parse(old_values)
        } catch {
          old_values = null
        }
      }

      // Fall back to metadata if new_values is null/undefined/empty
      const hasNewValues = new_values && Object.keys(new_values).length > 0
      const hasOldValues = old_values && Object.keys(old_values).length > 0

      if (!hasNewValues && log.metadata?.new_values) {
        new_values = log.metadata.new_values
      }
      if (!hasOldValues && log.metadata?.old_values) {
        old_values = log.metadata.old_values
      }

      // Ensure we have objects
      new_values = new_values || {}
      old_values = old_values || {}

      const entity_type = (log.entity_type || log.table_name || "unknown").toLowerCase()
      const entity_id = log.entity_id || log.record_id
      const action = log.action || log.operation || "unknown"
      const department = log.department || new_values.department || old_values.department || null
      const changed_fields = log.changed_fields || []

      return {
        id: log.id,
        user_id: log.user_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values,
        created_at: log.created_at,
        department,
        changed_fields,
        user: log.user_id ? usersMap.get(log.user_id) : null,
        // Pre-extract unique_code if available in metadata to avoid flash
        asset_info:
          new_values.unique_code || old_values.unique_code
            ? {
                unique_code: new_values.unique_code || old_values.unique_code,
                serial_number: new_values.serial_number || old_values.serial_number,
                asset_name: new_values.asset_name || old_values.asset_name,
              }
            : null,
      }
    }) as AuditLog[]
  }

  // Load employee for filter
  let employeeQuery = supabase
    .from("profiles")
    .select("id, first_name, last_name, department")
    .order("last_name", { ascending: true })

  if (profile.role === "lead" && profile.lead_departments && profile.lead_departments.length > 0) {
    employeeQuery = employeeQuery.in("department", profile.lead_departments)
  }

  const { data: employeeData } = await employeeQuery
  employee = employeeData || []

  // Get unique departments from audit logs department column and employee profiles
  const logDepartments = logsData?.map((log: any) => log.department).filter(Boolean) || []
  if (profile.role === "lead" && profile.lead_departments && profile.lead_departments.length > 0) {
    departments = profile.lead_departments.sort()
  } else {
    const employeeDepartments = employeeData?.map((s: any) => s.department).filter(Boolean) || []
    departments = Array.from(new Set([...employeeDepartments, ...logDepartments])) as string[]
    departments.sort()
  }

  return { logs, employee, departments, userProfile }
}

export default async function AuditLogsPage() {
  const data = await getAuditLogsData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const pageData = data as {
    logs: AuditLog[]
    employee: employeeMember[]
    departments: string[]
    userProfile: UserProfile
  }

  return (
    <AdminAuditLogsContent
      initialLogs={pageData.logs}
      initialemployee={pageData.employee}
      initialDepartments={pageData.departments}
      userProfile={pageData.userProfile}
    />
  )
}
