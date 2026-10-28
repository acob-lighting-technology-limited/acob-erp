import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { AdminPmsReviewsPage } from "@/app/admin/pms/reviews/view"

export const metadata: Metadata = { title: "Dept Reviews" }
import type { Metadata } from "next"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptPmsReviewsPage({ params }: Props) {
  const { dept_id } = await params
  await requireDeptScope(dept_id)
  return (
    <AdminPmsReviewsPage backLinkHref={`/dept/${dept_id}/pms`} reviewCycleBasePath={`/dept/${dept_id}/pms/reviews`} />
  )
}
