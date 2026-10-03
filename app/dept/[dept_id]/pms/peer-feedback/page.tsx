import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { AdminPeerFeedbackPage as AdminPmsPeerFeedbackPage } from "@/app/admin/pms/peer-feedback/view"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptPmsPeerFeedbackPage({ params }: Props) {
  const { dept_id } = await params
  await requireDeptScope(dept_id)
  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <AdminPmsPeerFeedbackPage backLinkHref={`/dept/${dept_id}/pms`} />
    </TablePageLayoutProvider>
  )
}
