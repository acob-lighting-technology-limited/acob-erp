import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { isAdminLikeRole } from "@/lib/admin/rbac"
import { ProjectContent } from "./project-content"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Projects & Deployments | Matrix",
  description: "View ongoing mini-grid electrification and solar installations progress and task milestones.",
}

type DbClient = Awaited<ReturnType<typeof createClient>>

export default async function ProjectsPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, is_department_lead, department")
    .eq("id", user.id)
    .single()

  const { data: profiles, error: profilesError } = await getServiceRoleClientOrFallback(supabase as DbClient)
    .from("profiles")
    .select("id, first_name, last_name, full_name, department, company_email")
    .neq("employment_status", "exited")
    .order("first_name", { ascending: true })

  if (profilesError) {
    console.error("Error loading profiles for project manager assignment:", profilesError)
  }

  const assignableEmployees = (profiles || []).map((p) => ({
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
    canManage: isAdminLikeRole(profile?.role) || Boolean(profile?.is_department_lead),
  }

  return <ProjectContent profiles={assignableEmployees} currentUser={currentUser} />
}
