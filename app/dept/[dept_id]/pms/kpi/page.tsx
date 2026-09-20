import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { DeptPmsKpiView } from "./_components/dept-pms-kpi-view"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptPmsKpiPage({ params }: Props) {
  const { dept_id } = await params
  const scope = await requireDeptScope(dept_id)
  return <DeptPmsKpiView deptId={dept_id} deptName={scope.deptName} />
}
