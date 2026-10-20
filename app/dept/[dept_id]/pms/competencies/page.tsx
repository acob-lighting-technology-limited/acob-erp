import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { AdminCompetenciesPage as AdminPmsCompetenciesPage } from "@/app/admin/pms/competencies/view"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptPmsCompetenciesPage({ params }: Props) {
  const { dept_id } = await params
  await requireDeptScope(dept_id)
  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <AdminPmsCompetenciesPage backLinkHref={`/dept/${dept_id}/pms`} />
    </TablePageLayoutProvider>
  )
}
