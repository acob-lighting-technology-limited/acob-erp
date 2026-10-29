import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { OfficeLocationsPage as AdminOfficeLocationPage } from "@/app/admin/hr/offices-rooms/view"

export const metadata: Metadata = { title: "Dept Offices & Rooms" }
import type { Metadata } from "next"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptOfficeLocationPage({ params }: Props) {
  const { dept_id } = await params
  await requireDeptScope(dept_id)
  return (
    <AdminOfficeLocationPage backLinkHref={`/dept/${dept_id}/hr`} employeesBasePath={`/dept/${dept_id}/hr/employees`} />
  )
}
