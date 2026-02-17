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

  // Fetch audit logs - Filter out internal system logs to prevent them from eclipsing user actions
  const { data: logsData, error: logsError } = await supabase
    .from("audit_logs")
    .select("*")
    .not("action", "in", '("sync","migrate","update_schema","migration")')
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
    // 1. Pre-process logs to parse JSON columns
    const parsedLogs = logsData.map((log) => {
      let new_values = log.new_values
      let old_values = log.old_values

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
      if ((!new_values || Object.keys(new_values || {}).length === 0) && log.metadata?.new_values) {
        new_values = log.metadata.new_values
      }
      if ((!old_values || Object.keys(old_values || {}).length === 0) && log.metadata?.old_values) {
        old_values = log.metadata.old_values
      }

      // Ensure we have objects
      new_values = new_values || {}
      old_values = old_values || {}

      return {
        ...log,
        new_values,
        old_values,
        entity_type: (log.entity_type || log.table_name || "unknown").toLowerCase(),
        action: log.action || log.operation || "unknown",
        entity_id: log.entity_id || log.record_id,
      }
    })

    // 2. Collect all relevant IDs
    const actorIds = new Set(parsedLogs.map((l) => l.user_id).filter(Boolean))
    const assetIds = new Set<string>()
    const potentialUserIds = new Set<string>()

    parsedLogs.forEach((log) => {
      // Collect IDs from JSON blobs
      const targets = [
        log.new_values.assigned_to,
        log.old_values.assigned_to,
        log.new_values.user_id,
        log.old_values.user_id,
        log.new_values.target_user_id,
        log.old_values.target_user_id,
        // For profiles/users table, the record_id itself is a user ID
        log.entity_type === "profile" || log.entity_type === "profiles" || log.entity_type === "user"
          ? log.entity_id
          : null,
      ]

      targets.forEach((id) => {
        if (id && typeof id === "string" && id.length === 36) potentialUserIds.add(id)
      })

      // Collect Asset IDs
      if (log.entity_type.includes("asset")) {
        // Try to get asset_id from entity_id (if it's an asset) or from values
        const possibleAssetId = log.entity_id
        if (possibleAssetId && possibleAssetId.length === 36) assetIds.add(possibleAssetId)

        if (log.new_values.asset_id && log.new_values.asset_id.length === 36) assetIds.add(log.new_values.asset_id)
      }
    })

    // 3. Fetch current asset assignments
    const assetAssignmentsMap = new Map()
    if (assetIds.size > 0) {
      const { data: assignments, error: assignmentsError } = await supabase
        .from("asset_assignments")
        .select("asset_id, assigned_to, assignment_type")
        .in("asset_id", Array.from(assetIds))
        .eq("is_current", true)

      if (assignmentsError) {
        console.error("Error fetching asset assignments for audit logs:", assignmentsError)
      } else {
        assignments?.forEach((a) => {
          assetAssignmentsMap.set(a.asset_id, a)
          if (a.assigned_to) potentialUserIds.add(a.assigned_to)
        })
      }
    }

    // 4. Fetch all users
    const allUserIds = Array.from(new Set([...Array.from(actorIds), ...Array.from(potentialUserIds)]))
    let usersData: any[] = []

    if (allUserIds.length > 0) {
      const { data, error: usersError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, company_email, employee_number")
        .in("id", allUserIds)

      if (usersError) {
        console.error("Error fetching users for audit logs:", usersError)
      } else {
        usersData = data || []
      }
    }

    const usersMap = new Map(usersData.map((u) => [u.id, u]))

    // 5. Build final logs
    logs = parsedLogs.map((log) => {
      const department = log.department || log.new_values.department || log.old_values.department || null
      const changed_fields = log.changed_fields || []

      // Determine related asset info
      let assetInfo = null
      let assetId = null

      if (log.entity_type.includes("asset")) {
        // Clearer logic to determine the relevant asset ID
        if (log.entity_type.includes("assignment")) {
          assetId = log.new_values.asset_id || log.old_values.asset_id || log.entity_id
        } else {
          assetId = log.entity_id
        }

        const assignment = assetId ? assetAssignmentsMap.get(assetId) : null

        // Base info from logs
        const baseInfo = {
          unique_code: log.new_values.unique_code || log.old_values.unique_code,
          serial_number: log.new_values.serial_number || log.old_values.serial_number,
          asset_name: log.new_values.asset_name || log.old_values.asset_name,
        }

        // Merge with assignment info, PREFERRING historical values from the log
        if (baseInfo.unique_code || assignment) {
          const historicalAssignedTo = log.new_values.assigned_to || log.old_values.assigned_to
          const targetAssignedTo = historicalAssignedTo || assignment?.assigned_to

          assetInfo = {
            ...baseInfo,
            assignment_type:
              log.new_values.assignment_type || log.old_values.assignment_type || assignment?.assignment_type,
            assigned_to: targetAssignedTo,
            assigned_to_user: targetAssignedTo ? usersMap.get(targetAssignedTo) || null : null,
          }
        }
      }

      // Determine Target User
      let targetUser = null

      // Priority 1: Explicit target in log (most accurate for historical events)
      // Check for assigned_to in new_values (common in asset assignment logs)
      // Check for target_user_id (standard audit log field)
      // Check for user_id in new_values IF it's different from the actor (though rare)
      const targetId = log.new_values.assigned_to || log.original_data?.target_user_id || log.new_values.target_user_id

      if (targetId && usersMap.has(targetId)) {
        targetUser = usersMap.get(targetId)
      }
      // Priority 2: For asset assignments, if we can't find it in new_values, maybe it's in assetInfo
      // BUT we must be careful not to use *current* assignment for *old* logs.
      // We only use assetInfo.assigned_to_user if the log action suggests it might be relevant AND it matches?
      // Actually, relying on current assignment for old logs is what caused the bug.
      // Better to check if the log provides a hint.
      // If the log is "ASSIGN" or "REASSIGN" and we have no targetId, it's better to show nothing than the wrong person.
      // However, for the "Unassigned" bug case, the log *had* no target.
      // If we fixed the bug, FUTURE logs will have targetId.
      // Past logs for "Unassigned" actions are just broken.
      // We will NOT default to current user to avoid "history rewriting".

      // Priority 3: Entity is the user (for profile updates)
      else if (
        (log.entity_type === "profile" || log.entity_type === "profiles" || log.entity_type === "user") &&
        usersMap.has(log.entity_id)
      ) {
        targetUser = usersMap.get(log.entity_id)
      }

      return {
        id: log.id,
        user_id: log.user_id,
        action: log.action,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        old_values: log.old_values,
        new_values: log.new_values,
        created_at: log.created_at,
        department,
        changed_fields,
        user: log.user_id ? usersMap.get(log.user_id) || null : null,
        asset_info: assetInfo,
        target_user: targetUser || null,
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
