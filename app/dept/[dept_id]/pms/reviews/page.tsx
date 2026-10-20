import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { AdminPmsReviewsPage } from "@/app/admin/pms/reviews/view"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptPmsReviewsPage({ params }: Props) {
  const { dept_id } = await params
  await requireDeptScope(dept_id)
  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <AdminPmsReviewsPage backLinkHref={`/dept/${dept_id}/pms`} reviewCycleBasePath={`/dept/${dept_id}/pms/reviews`} />
    </TablePageLayoutProvider>
  )
}
