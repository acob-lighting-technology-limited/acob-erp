import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { AdminPeerFeedbackPage as AdminPmsPeerFeedbackPage } from "@/app/admin/pms/peer-feedback/view"

export const metadata: Metadata = { title: "Dept Peer Feedback" }
import type { Metadata } from "next"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptPmsPeerFeedbackPage({ params }: Props) {
  const { dept_id } = await params
  await requireDeptScope(dept_id)
  return <AdminPmsPeerFeedbackPage backLinkHref={`/dept/${dept_id}/pms`} />
}
