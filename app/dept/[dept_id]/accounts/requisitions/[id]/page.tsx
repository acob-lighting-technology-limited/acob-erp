import type { Metadata } from "next"
import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { RequisitionDetail } from "@/components/requisitions/requisition-detail"

export const metadata: Metadata = { title: "Dept Requisition details" }

interface Props {
  params: Promise<{ dept_id: string; id: string }>
}

export default async function DeptRequisitionDetailPage({ params }: Props) {
  const { dept_id, id } = await params
  await requireDeptScope(dept_id)
  // The detail API decides who may read the requisition.
  return <RequisitionDetail id={id} backHref={`/dept/${dept_id}/accounts/requisitions`} />
}
