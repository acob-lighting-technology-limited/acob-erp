import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import AdminPmsCbtPage from "@/app/admin/pms/cbt/page"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptPmsCbtPage({ params }: Props) {
  const { dept_id } = await params
  await requireDeptScope(dept_id)
  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <AdminPmsCbtPage deptId={dept_id} />
    </TablePageLayoutProvider>
  )
}
