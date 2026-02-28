import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getDepartmentScope, resolveAdminScope } from "@/lib/admin/rbac"
import {
  AdminDocumentationContent,
  type Documentation,
  type UserProfile,
  type employeeMember,
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

  const scope = await resolveAdminScope(supabase as any, user.id)
  if (!scope) {
    return { redirect: "/dashboard" as const }
  }
  const departmentScope = getDepartmentScope(scope, "general")

  const userProfile: UserProfile = {
    role: scope.role as any,
    lead_departments: scope.leadDepartments,
    managed_departments: scope.managedDepartments,
  }

  // Fetch documentation - leads can only see documentation from their departments
  let documentation: Documentation[] = []
  let employee: employeeMember[] = []

  let docsQuery = supabase.from("user_documentation").select("*").order("created_at", { ascending: false })

  if (departmentScope) {
    const { data: deptUsers } =
      departmentScope.length > 0
        ? await supabase.from("profiles").select("id").in("department", departmentScope)
        : { data: [] as { id: string }[] }

    const userIds = deptUsers?.map((u) => u.id) || []
    if (userIds.length > 0) {
      docsQuery = docsQuery.in("user_id", userIds)
    } else {
      return { documentation: [], employee: [], userProfile }
    }
  }

  const { data: docsData, error: docsError } = await docsQuery

  if (docsError) {
    console.error("Documentation error:", docsError)
    return { documentation: [], employee: [], userProfile }
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

  // Load employee for filter
  let employeeQuery = supabase
    .from("profiles")
    .select("id, first_name, last_name, department")
    .order("last_name", { ascending: true })
  if (departmentScope) {
    employeeQuery =
      departmentScope.length > 0 ? employeeQuery.in("department", departmentScope) : employeeQuery.eq("id", "__none__")
  }
  const { data: employeeData } = await employeeQuery

  employee = employeeData || []

  return { documentation, employee, userProfile }
}

export default async function AdminDocumentationPage() {
  const data = await getAdminDocumentationData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const pageData = data as { documentation: Documentation[]; employee: employeeMember[]; userProfile: UserProfile }

  return (
    <AdminDocumentationContent
      initialDocumentation={pageData.documentation}
      initialemployee={pageData.employee}
      userProfile={pageData.userProfile}
    />
  )
}
