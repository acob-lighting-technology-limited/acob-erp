import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { PmsAnalyticsPage as AdminPmsAnalyticsPage } from "@/app/admin/pms/analytics/view"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptPmsAnalyticsPage({ params }: Props) {
  const { dept_id } = await params
  await requireDeptScope(dept_id)
  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <AdminPmsAnalyticsPage backLinkHref={`/dept/${dept_id}/pms`} />
    </TablePageLayoutProvider>
  )
}
