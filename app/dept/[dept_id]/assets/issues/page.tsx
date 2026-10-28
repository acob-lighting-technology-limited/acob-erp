import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { AssetIssuesPage as AdminAssetIssuesPage } from "@/app/admin/assets/issues/view"

export const metadata: Metadata = { title: "Dept Issues" }
import type { Metadata } from "next"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptAssetIssuesPage({ params }: Props) {
  const { dept_id } = await params
  const scope = await requireDeptScope(dept_id)
  return <AdminAssetIssuesPage backLinkHref={`/dept/${dept_id}/assets`} lockedDepartment={scope.deptName} />
}
