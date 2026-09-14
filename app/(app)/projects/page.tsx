import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ProjectContent } from "./project-content"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Projects & Deployments | Matrix",
  description: "View ongoing mini-grid electrification and solar installations progress and task milestones.",
}

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

  const currentUser = {
    id: user.id,
    role: profile?.role || "employee",
    is_department_lead: Boolean(profile?.is_department_lead),
    department: profile?.department || null,
  }

  return <ProjectContent currentUser={currentUser} />
}
