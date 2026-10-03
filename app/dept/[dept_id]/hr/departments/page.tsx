import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { DepartmentsPage as AdminDepartmentsPage } from "@/app/admin/hr/departments/view"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptDepartmentsPage({ params }: Props) {
  const { dept_id } = await params
  await requireDeptScope(dept_id)
  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <AdminDepartmentsPage backLinkHref={`/dept/${dept_id}/hr`} employeesBasePath={`/dept/${dept_id}/hr/employees`} />
    </TablePageLayoutProvider>
  )
}
