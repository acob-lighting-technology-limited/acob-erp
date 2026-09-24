import { redirect } from "next/navigation"
import { requireDeptScope } from "@/lib/dept/require-dept-scope"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptCorporateServicesPage({ params }: Props) {
  const { dept_id } = await params
  await requireDeptScope(dept_id)
  redirect(`/dept/${dept_id}/corporate-services/scorecard`)
}
