import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { ReviewCyclesPage as AdminPmsCyclesPage } from "@/app/admin/pms/cycles/view"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptPmsCyclesPage({ params }: Props) {
  const { dept_id } = await params
  await requireDeptScope(dept_id)
  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <AdminPmsCyclesPage backLinkHref={`/dept/${dept_id}/pms`} />
    </TablePageLayoutProvider>
  )
}
