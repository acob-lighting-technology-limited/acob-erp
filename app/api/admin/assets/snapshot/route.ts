import { NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { getDepartmentScope, resolveAdminScope } from "@/lib/admin/rbac"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const scope = await resolveAdminScope(supabase as any, user.id)
  if (!scope) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const departmentScope = getDepartmentScope(scope, "general")

  const dataClient =
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : supabase

  const { data: assetsData, error: assetsError } = await dataClient
    .from("assets")
    .select("*")
    .order("created_at", { ascending: false })

  if (assetsError) {
    return NextResponse.json({ error: assetsError.message }, { status: 500 })
  }

  const { data: assignmentsData } = await dataClient
    .from("asset_assignments")
    .select("asset_id, assigned_to, department, office_location")
    .eq("is_current", true)

  const assignedUserIds = (assignmentsData || []).map((a: any) => a.assigned_to).filter(Boolean)

  let assignmentUsersMap = new Map<string, any>()
  if (assignedUserIds.length > 0) {
    const { data: usersData } = await dataClient
      .from("profiles")
      .select("id, first_name, last_name, department")
      .in("id", assignedUserIds)

    assignmentUsersMap = new Map((usersData || []).map((u) => [u.id, u]))
  }

  let employeeQuery = dataClient
    .from("profiles")
    .select("id, first_name, last_name, company_email, department, employment_status")
    .eq("employment_status", "active")
    .order("last_name", { ascending: true })

  if (departmentScope) {
    employeeQuery =
      departmentScope.length > 0 ? employeeQuery.in("department", departmentScope) : employeeQuery.eq("id", "__none__")
  }

  const { data: employeeData } = await employeeQuery
  const employees = employeeData || []

  const { data: issuesData } = await dataClient.from("asset_issues").select("asset_id, resolved")

  const issueCountsByAsset: Record<string, number> = {}
  ;(issuesData || []).forEach((issue: any) => {
    if (!issue.resolved) {
      issueCountsByAsset[issue.asset_id] = (issueCountsByAsset[issue.asset_id] || 0) + 1
    }
  })

  let filteredAssets = assetsData || []
  if (departmentScope) {
    const deptUserIds = employees.map((s: any) => s.id)
    filteredAssets = filteredAssets.filter((asset: any) => {
      const assignment = (assignmentsData || []).find((a: any) => a.asset_id === asset.id)
      if (!assignment) return false

      if (assignment.assigned_to && deptUserIds.includes(assignment.assigned_to)) return true
      if (assignment.department && departmentScope.includes(assignment.department)) return true
      if (assignment.office_location && scope.managedOffices.includes(assignment.office_location)) return true
      return false
    })
  }

  const assets = filteredAssets.map((asset: any) => {
    const assignment = (assignmentsData || []).find((a: any) => a.asset_id === asset.id)
    return {
      ...asset,
      current_assignment: assignment
        ? {
            assigned_to: assignment.assigned_to,
            department: assignment.department,
            office_location: assignment.office_location,
            user: assignment.assigned_to ? assignmentUsersMap.get(assignment.assigned_to) : null,
          }
        : undefined,
      unresolved_issues_count: issueCountsByAsset[asset.id] || 0,
    }
  })

  return NextResponse.json({ assets, employees })
}
