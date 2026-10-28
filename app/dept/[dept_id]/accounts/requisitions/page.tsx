import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { RequisitionsListPage } from "@/components/requisitions/requisitions-list-page"

export const metadata: Metadata = { title: "Dept Requisitions" }
import type { Metadata } from "next"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptFinanceRequisitionsPage({ params }: Props) {
  const { dept_id } = await params
  const scope = await requireDeptScope(dept_id)

  // Locked to this console's department; the API enforces it too.
  return <RequisitionsListPage surface="dept" deptName={scope.deptName} />
}
