import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { AdminDevelopmentPlansPage as AdminPmsDevelopmentPlansPage } from "@/app/admin/pms/development-plans/view"

export const metadata: Metadata = { title: "Dept Development Plans" }
import type { Metadata } from "next"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptPmsDevelopmentPlansPage({ params }: Props) {
  const { dept_id } = await params
  await requireDeptScope(dept_id)
  return <AdminPmsDevelopmentPlansPage backLinkHref={`/dept/${dept_id}/pms`} />
}
