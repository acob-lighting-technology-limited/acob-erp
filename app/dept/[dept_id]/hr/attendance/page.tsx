import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { AttendanceReportsPage as AdminAttendancePage } from "@/app/admin/hr/attendance/view"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptAttendancePage({ params }: Props) {
  const { dept_id } = await params
  const scope = await requireDeptScope(dept_id)
  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <AdminAttendancePage backLinkHref={`/dept/${dept_id}/hr`} lockedDepartment={scope.deptName} />
    </TablePageLayoutProvider>
  )
}
