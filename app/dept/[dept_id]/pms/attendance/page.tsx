import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { AdminPmsAttendancePage } from "@/app/admin/pms/attendance/view"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptPmsAttendancePage({ params }: Props) {
  const { dept_id } = await params
  await requireDeptScope(dept_id)
  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <AdminPmsAttendancePage
        backLinkHref={`/dept/${dept_id}/pms`}
        attendanceBasePath={`/dept/${dept_id}/hr/attendance`}
      />
    </TablePageLayoutProvider>
  )
}
