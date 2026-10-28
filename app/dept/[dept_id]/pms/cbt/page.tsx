import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import AdminPmsCbtPage from "@/app/admin/pms/cbt/page-client"

export const metadata: Metadata = { title: "Dept CBT" }
import type { Metadata } from "next"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptPmsCbtPage({ params }: Props) {
  const { dept_id } = await params
  await requireDeptScope(dept_id)
  return <AdminPmsCbtPage deptId={dept_id} />
}
