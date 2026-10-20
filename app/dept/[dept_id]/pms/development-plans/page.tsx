import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { AdminDevelopmentPlansPage as AdminPmsDevelopmentPlansPage } from "@/app/admin/pms/development-plans/view"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptPmsDevelopmentPlansPage({ params }: Props) {
  const { dept_id } = await params
  await requireDeptScope(dept_id)
  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <AdminPmsDevelopmentPlansPage backLinkHref={`/dept/${dept_id}/pms`} />
    </TablePageLayoutProvider>
  )
}
