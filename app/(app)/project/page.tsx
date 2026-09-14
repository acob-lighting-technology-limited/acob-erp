import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { isAdminLikeRole } from "@/lib/admin/rbac"
import { ProjectContent } from "./project-content"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Projects Dashboard | Matrix",
  description: "View and track ongoing electrification project deployment tasks and milestones.",
}

export default async function ProjectsPage() {
  const supabase = await createClient()
  const dataClient = getServiceRoleClientOrFallback(supabase as any)

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  type ProfileSelectRow = {
    id: string
    first_name: string | null
    last_name: string | null
    full_name: string | null
    department: string | null
    company_email: string | null
  }

  const [{ data: profile }, { data: profiles }] = await Promise.all([
    supabase.from("profiles").select("id, role, is_department_lead, department").eq("id", user.id).single(),
    dataClient
      .from("profiles")
      .select("id, first_name, last_name, full_name, department, company_email")
      .neq("employment_status", "exited")
      .order("first_name", { ascending: true }),
  ])

  const assignableEmployees = ((profiles || []) as ProfileSelectRow[]).map((p) => ({
    id: p.id,
    first_name: p.first_name || "",
    last_name: p.last_name || "",
    full_name: p.full_name,
    company_email: p.company_email || "",
    department: p.department || "",
  }))

  const currentUser = {
    id: user.id,
    role: profile?.role || "employee",
    is_department_lead: Boolean(profile?.is_department_lead),
    department: profile?.department || null,
    isAdmin: isAdminLikeRole(profile?.role),
  }

  return <ProjectContent currentUser={currentUser} profiles={assignableEmployees} />
}
