import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminAssetsContent, type Asset, type Staff, type UserProfile } from "./admin-assets-content"

async function getAdminAssetsData() {
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

  // Fetch assets
  const { data: assetsData, error: assetsError } = await supabase
    .from("assets")
    .select("*")
    .order("created_at", { ascending: false })

  if (assetsError) {
    console.error("Error loading assets:", assetsError)
    return { assets: [], staff: [], departments: [], userProfile }
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

  // Fetch staff - leads can only see staff in their departments
  let staffQuery = supabase
    .from("profiles")
    .select("id, first_name, last_name, company_email, department")
    .order("last_name", { ascending: true })

  if (profile.role === "lead" && profile.lead_departments && profile.lead_departments.length > 0) {
    staffQuery = staffQuery.in("department", profile.lead_departments)
  }

  const { data: staffData } = await staffQuery
  const staff = (staffData || []) as Staff[]

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
  if (profile.role === "lead" && profile.lead_departments && profile.lead_departments.length > 0) {
    const deptUserIds = staff.map((s) => s.id)
    filteredAssets = filteredAssets.filter((asset) => {
      const assignment = (assignmentsData || []).find((a: any) => a.asset_id === asset.id)
      if (!assignment) return false

      if (assignment.assigned_to && deptUserIds.includes(assignment.assigned_to)) return true
      if (assignment.department && profile.lead_departments.includes(assignment.department)) return true
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
  const departments =
    profile.role === "lead" && profile.lead_departments
      ? profile.lead_departments
      : Array.from(new Set(staff.map((s) => s.department).filter(Boolean)))

  return { assets, staff, departments, userProfile }
}

export default async function AdminAssetsPage() {
  const data = await getAdminAssetsData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const pageData = data as {
    assets: Asset[]
    staff: Staff[]
    departments: string[]
    userProfile: UserProfile
  }

  return (
    <AdminAssetsContent
      initialAssets={pageData.assets}
      initialStaff={pageData.staff}
      initialDepartments={pageData.departments}
      userProfile={pageData.userProfile}
    />
  )
}
