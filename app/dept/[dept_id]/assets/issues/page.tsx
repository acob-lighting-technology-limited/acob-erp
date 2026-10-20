import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { AssetIssuesPage as AdminAssetIssuesPage } from "@/app/admin/assets/issues/view"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptAssetIssuesPage({ params }: Props) {
  const { dept_id } = await params
  const scope = await requireDeptScope(dept_id)
  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <AdminAssetIssuesPage backLinkHref={`/dept/${dept_id}/assets`} lockedDepartment={scope.deptName} />
    </TablePageLayoutProvider>
  )
}
