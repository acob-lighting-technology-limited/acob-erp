import { redirect } from "next/navigation"

// Goals live on the KPI page now (strategic objectives from the scorecard).
export default async function DeptPmsGoalsPage({ params }: { params: Promise<{ dept_id: string }> }) {
  const { dept_id } = await params
  redirect(`/dept/${dept_id}/pms/kpi?tab=goals`)
}
