import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { ChallengesView } from "@/components/reports/challenges/challenges-view"

export default async function PortalChallengesPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) redirect("/auth/login")

  const dataClient = getServiceRoleClientOrFallback(supabase)

  const [{ data: profile }, { data: deptRows }] = await Promise.all([
    dataClient
      .from("profiles")
      .select("id, role, department, is_department_lead, lead_departments")
      .eq("id", user.id)
      .single(),
    dataClient.from("departments").select("name").order("name"),
  ])

  const departments = (deptRows || []).map((d: { name: string }) => d.name).filter(Boolean)

  return (
    <ChallengesView
      isAdminContext={false}
      backHref="/reports/general-meeting"
      backLabel="Back to General Meeting"
      userRole={profile?.role || ""}
      userDepartment={profile?.department || null}
      isDepartmentLead={Boolean(profile?.is_department_lead)}
      leadDepartments={profile?.lead_departments || []}
      departments={departments}
    />
  )
}
