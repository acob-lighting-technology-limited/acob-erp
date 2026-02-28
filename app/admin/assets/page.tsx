import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminAssetsContent, type Asset, type Employee, type UserProfile } from "./admin-assets-content"
import { getDepartmentScope, resolveAdminScope } from "@/lib/admin/rbac"

async function getAdminAssetsData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  const scope = await resolveAdminScope(supabase as any, user.id)
  if (!scope) {
    return { redirect: "/dashboard" as const }
  }

  const userProfile: UserProfile = {
    role: scope.role,
    lead_departments: scope.leadDepartments,
    managed_departments: scope.managedDepartments,
    managed_offices: scope.managedOffices,
  }
  const departmentScope = getDepartmentScope(scope, "general")

  // Fetch assets
  const { data: assetsData, error: assetsError } = await supabase
    .from("assets")
    .select("*")
    .order("created_at", { ascending: false })

  if (assetsError) {
    console.error("Error loading assets:", assetsError)
    return { assets: [], employees: [], departments: [], userProfile }
  }

  // Fetch current assignments for all assets
  const { data: assignmentsData } = await supabase
    .from("asset_assignments")
    .select("asset_id, assigned_to, department, office_location")
    .eq("is_current", true)

  // Fetch user details for assignments
  const assignedUserIds = (assignmentsData || []).map((a: any) => a.assigned_to).filter(Boolean)

  let assignmentUsersMap = new Map()
  if (assignedUserIds.length > 0) {
    const { data: usersData } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, department")
      .in("id", assignedUserIds)

    assignmentUsersMap = new Map(usersData?.map((u) => [u.id, u]))
  }

  // Fetch employees - leads can only see employees in their departments
  let employeeQuery = supabase
    .from("profiles")
    .select("id, first_name, last_name, company_email, department, employment_status")
    .eq("employment_status", "active")
    .order("last_name", { ascending: true })

  if (departmentScope) {
    employeeQuery =
      departmentScope.length > 0 ? employeeQuery.in("department", departmentScope) : employeeQuery.eq("id", "__none__")
  }

  const { data: employeeData } = await employeeQuery
  const employees = (employeeData || []) as Employee[]

  // Fetch unresolved issue counts
  const { data: issuesData } = await supabase.from("asset_issues").select("asset_id, resolved")

  const issueCountsByAsset: Record<string, number> = {}
  ;(issuesData || []).forEach((issue: any) => {
    if (!issue.resolved) {
      issueCountsByAsset[issue.asset_id] = (issueCountsByAsset[issue.asset_id] || 0) + 1
    }
  })

  // Filter assets for leads
  let filteredAssets = assetsData || []
  if (departmentScope) {
    const deptUserIds = employees.map((s) => s.id)
    filteredAssets = filteredAssets.filter((asset) => {
      const assignment = (assignmentsData || []).find((a: any) => a.asset_id === asset.id)
      if (!assignment) return false

      if (assignment.assigned_to && deptUserIds.includes(assignment.assigned_to)) return true
      if (assignment.department && departmentScope.includes(assignment.department)) return true
      if (assignment.office_location && scope.managedOffices.includes(assignment.office_location)) return true
      return false
    })
  }

  // Combine assets with assignments and issue counts
  const assets: Asset[] = filteredAssets.map((asset) => {
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

  // Get departments list
  const departments = departmentScope
    ? departmentScope
    : Array.from(new Set(employees.map((s) => s.department).filter(Boolean)))

  return { assets, employees, departments, userProfile }
}

export default async function AdminAssetsPage() {
  const data = await getAdminAssetsData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const pageData = data as {
    assets: Asset[]
    employees: Employee[]
    departments: string[]
    userProfile: UserProfile
  }

  return (
    <AdminAssetsContent
      initialAssets={pageData.assets}
      initialEmployees={pageData.employees}
      initialDepartments={pageData.departments}
      userProfile={pageData.userProfile}
    />
  )
}
