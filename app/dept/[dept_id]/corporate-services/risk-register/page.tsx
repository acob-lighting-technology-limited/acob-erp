import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { RiskRegisterView } from "@/app/admin/corporate-services/risk-register/_components/risk-register-view"

export const metadata: Metadata = {
  title: "Department Risk Register | Corporate Services | Matrix",
  description: "Departmental risks, inherent ratings, control owners, and mitigation plans.",
}

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptRiskRegisterPage({ params }: Props) {
  const { dept_id } = await params
  const scope = await requireDeptScope(dept_id)

  const supabase = await createClient()
  const [deptRes, staffRes] = await Promise.all([
    supabase
      .from("departments")
      .select("name, department_code")
      .eq("name", scope.deptName)
      .maybeSingle<{ name: string; department_code: string | null }>(),
    supabase
      .from("staff_directory")
      .select("id, full_name, department, employment_status")
      .eq("department", scope.deptName)
      .order("full_name"),
  ])

  const departmentCode = deptRes.data?.department_code ?? null
  const departments = [{ name: scope.deptName, code: departmentCode }]
  const staff = (
    (staffRes.data || []) as Array<{
      id: string
      full_name: string
      department: string | null
      employment_status: string | null
    }>
  ).map((s) => ({ id: s.id, name: s.full_name, department: s.department, active: s.employment_status === "active" }))

  return (
    <RiskRegisterView
      departments={departments}
      staff={staff}
      raisableDepartments={[scope.deptName]}
      currentUserId={scope.userId}
      isAdminLike={scope.isAdminLike}
      lockedDepartment={scope.deptName}
      backLink={{ href: `/dept/${dept_id}`, label: "Back to Dashboard" }}
    />
  )
}
