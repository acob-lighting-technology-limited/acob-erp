import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import {
  AdminDocumentationContent,
  type Documentation,
  type UserProfile,
  type StaffMember,
} from "./admin-documentation-content"

async function getAdminDocumentationData() {
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

  // Fetch documentation - leads can only see documentation from their departments
  let documentation: Documentation[] = []
  let staff: StaffMember[] = []

  let docsQuery = supabase.from("user_documentation").select("*").order("created_at", { ascending: false })

  // If user is a lead, filter by their lead departments
  if (profile.role === "lead" && profile.lead_departments && profile.lead_departments.length > 0) {
    const { data: deptUsers } = await supabase.from("profiles").select("id").in("department", profile.lead_departments)

    const userIds = deptUsers?.map((u) => u.id) || []
    if (userIds.length > 0) {
      docsQuery = docsQuery.in("user_id", userIds)
    } else {
      return { documentation: [], staff: [], userProfile }
    }
  }

  const { data: docsData, error: docsError } = await docsQuery

  if (docsError) {
    console.error("Documentation error:", docsError)
    return { documentation: [], staff: [], userProfile }
  }

  // If we have documentation, fetch user details
  if (docsData && docsData.length > 0) {
    const userIdsSet = new Set(docsData.map((doc) => doc.user_id).filter(Boolean))
    const uniqueUserIds = Array.from(userIdsSet)

    const { data: usersData } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, company_email, department, role")
      .in("id", uniqueUserIds)

    const usersMap = new Map(usersData?.map((user) => [user.id, user]))

    documentation = docsData.map((doc) => ({
      ...doc,
      user: doc.user_id ? usersMap.get(doc.user_id) : undefined,
    })) as Documentation[]
  }

  // Load staff for filter
  const { data: staffData } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, department")
    .order("last_name", { ascending: true })

  staff = staffData || []

  return { documentation, staff, userProfile }
}

export default async function AdminDocumentationPage() {
  const data = await getAdminDocumentationData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const pageData = data as { documentation: Documentation[]; staff: StaffMember[]; userProfile: UserProfile }

  return (
    <AdminDocumentationContent
      initialDocumentation={pageData.documentation}
      initialStaff={pageData.staff}
      userProfile={pageData.userProfile}
    />
  )
}
