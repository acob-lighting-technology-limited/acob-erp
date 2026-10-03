import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { AdminPmsBehaviourPage } from "@/app/admin/pms/behaviour/view"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptPmsBehaviourPage({ params }: Props) {
  const { dept_id } = await params
  await requireDeptScope(dept_id)
  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <AdminPmsBehaviourPage
        backLinkHref={`/dept/${dept_id}/pms`}
        attendanceBasePath={`/dept/${dept_id}/hr/attendance`}
      />
    </TablePageLayoutProvider>
  )
}
