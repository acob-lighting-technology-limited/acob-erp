import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { DeptPmsKpiView } from "./_components/dept-pms-kpi-view"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptPmsKpiPage({ params }: Props) {
  const { dept_id } = await params
  const scope = await requireDeptScope(dept_id)
  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <DeptPmsKpiView deptId={dept_id} deptName={scope.deptName} />
    </TablePageLayoutProvider>
  )
}
