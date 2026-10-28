import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { CommunicationsPage as AdminCommunicationsPage } from "@/app/admin/communications/view"

export const metadata: Metadata = { title: "Dept Communications" }
import type { Metadata } from "next"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptCommunicationsPage({ params }: Props) {
  const { dept_id } = await params
  await requireDeptScope(dept_id)
  return <AdminCommunicationsPage basePath={`/dept/${dept_id}`} showMeetings={false} />
}
