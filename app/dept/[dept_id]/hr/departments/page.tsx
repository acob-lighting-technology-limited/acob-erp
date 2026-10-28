import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { DepartmentsPage as AdminDepartmentsPage } from "@/app/admin/hr/departments/view"

export const metadata: Metadata = { title: "Dept Departments" }
import type { Metadata } from "next"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptDepartmentsPage({ params }: Props) {
  const { dept_id } = await params
  await requireDeptScope(dept_id)
  return (
    <AdminDepartmentsPage backLinkHref={`/dept/${dept_id}/hr`} employeesBasePath={`/dept/${dept_id}/hr/employees`} />
  )
}
