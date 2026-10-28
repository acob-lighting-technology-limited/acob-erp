import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { ReviewCyclesPage as AdminPmsCyclesPage } from "@/app/admin/pms/cycles/view"

export const metadata: Metadata = { title: "Dept Cycles" }
import type { Metadata } from "next"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptPmsCyclesPage({ params }: Props) {
  const { dept_id } = await params
  await requireDeptScope(dept_id)
  return <AdminPmsCyclesPage backLinkHref={`/dept/${dept_id}/pms`} />
}
