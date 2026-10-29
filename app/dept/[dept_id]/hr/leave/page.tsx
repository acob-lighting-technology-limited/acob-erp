import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { LeaveApprovePage } from "@/app/admin/hr/leave/view"

export const metadata: Metadata = { title: "Dept Leave" }
import type { Metadata } from "next"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptLeaveApprovePage({ params }: Props) {
  const { dept_id } = await params
  await requireDeptScope(dept_id)
  return <LeaveApprovePage backLinkHref={`/dept/${dept_id}/hr`} apiBasePath={`/api/dept/${dept_id}/leave`} />
}
