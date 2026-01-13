import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminAuditLogsContent, type AuditLog, type StaffMember, type UserProfile } from "./admin-audit-logs-content"

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
    return { logs: [], staff: [], departments: [], userProfile }
  }

  let logs: AuditLog[] = []
  let staff: StaffMember[] = []
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

    // Add user info to logs (simplified for SSR - detailed info loaded client-side)
    logs = logsData.map((log) => ({
      ...log,
      user: log.user_id ? usersMap.get(log.user_id) : null,
    })) as AuditLog[]
  }

  // Load staff for filter
  let staffQuery = supabase
    .from("profiles")
    .select("id, first_name, last_name, department")
    .order("last_name", { ascending: true })

  if (profile.role === "lead" && profile.lead_departments && profile.lead_departments.length > 0) {
    staffQuery = staffQuery.in("department", profile.lead_departments)
  }

  const { data: staffData } = await staffQuery
  staff = staffData || []

  // Get unique departments
  if (profile.role === "lead" && profile.lead_departments && profile.lead_departments.length > 0) {
    departments = profile.lead_departments.sort()
  } else {
    departments = Array.from(new Set(staffData?.map((s: any) => s.department).filter(Boolean))) as string[]
    departments.sort()
  }

  return { logs, staff, departments, userProfile }
}

export default async function AuditLogsPage() {
  const data = await getAuditLogsData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const pageData = data as {
    logs: AuditLog[]
    staff: StaffMember[]
    departments: string[]
    userProfile: UserProfile
  }

  return (
    <AdminAuditLogsContent
      initialLogs={pageData.logs}
      initialStaff={pageData.staff}
      initialDepartments={pageData.departments}
      userProfile={pageData.userProfile}
    />
  )
}
