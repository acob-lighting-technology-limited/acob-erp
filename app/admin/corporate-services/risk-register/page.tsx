import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { resolveAdminScope } from "@/lib/admin/rbac"
import { leadsDepartment } from "@/lib/risk-register/server"
import { RiskRegisterView } from "./_components/risk-register-view"

export const metadata: Metadata = {
  title: "Risk Register | Corporate Services | Matrix",
  description: "Departmental risks, their inherent rating, control owners and mitigation plans.",
}

type DbClient = Awaited<ReturnType<typeof createClient>>

export default async function RiskRegisterPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect("/auth/login")

  const scope = await resolveAdminScope(supabase as DbClient, user.id)
  if (!scope) redirect("/profile")

  // staff_directory, not profiles: profiles RLS hides other staff from non-admins.
  const [departmentsRes, staffRes] = await Promise.all([
    supabase.from("departments").select("name, department_code").eq("is_active", true).order("name"),
    supabase.from("staff_directory").select("id, full_name, department, employment_status").order("full_name"),
  ])

  const departments = ((departmentsRes.data || []) as Array<{ name: string; department_code: string | null }>).map(
    (d) => ({ name: d.name, code: d.department_code })
  )
  const staff = (
    (staffRes.data || []) as Array<{
      id: string
      full_name: string
      department: string | null
      employment_status: string | null
    }>
  ).map((s) => ({ id: s.id, name: s.full_name, department: s.department, active: s.employment_status === "active" }))

  const raisableDepartments = scope.isAdminLike
    ? departments.map((d) => d.name)
    : departments.map((d) => d.name).filter((name) => leadsDepartment(scope, name))

  return (
    <RiskRegisterView
      departments={departments}
      staff={staff}
      raisableDepartments={raisableDepartments}
      currentUserId={user.id}
      isAdminLike={scope.isAdminLike}
    />
  )
}
