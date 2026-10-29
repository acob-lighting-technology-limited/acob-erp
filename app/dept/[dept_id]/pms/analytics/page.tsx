import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { PmsAnalyticsPage as AdminPmsAnalyticsPage } from "@/app/admin/pms/analytics/view"

export const metadata: Metadata = { title: "Dept Analytics" }
import type { Metadata } from "next"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptPmsAnalyticsPage({ params }: Props) {
  const { dept_id } = await params
  await requireDeptScope(dept_id)
  return <AdminPmsAnalyticsPage backLinkHref={`/dept/${dept_id}/pms`} />
}
