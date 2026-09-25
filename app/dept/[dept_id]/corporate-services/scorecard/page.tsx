import type { Metadata } from "next"
import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { DepartmentCascadeContent } from "@/app/admin/corporate-scorecard/_components/department-cascade-content"

export const metadata: Metadata = {
  title: "Department Scorecard | Corporate Services | Matrix",
  description: "Departmental KPI commitments, targets, and actual progress against the strategic plan.",
}

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptScorecardPage({ params }: Props) {
  const { dept_id } = await params
  const scope = await requireDeptScope(dept_id)

  return (
    <DepartmentCascadeContent
      departments={[scope.deptName]}
      initialDepartment={scope.deptName}
      lockedDepartment={scope.deptName}
      backLink={{ href: `/dept/${dept_id}`, label: "Back to Dashboard" }}
    />
  )
}
