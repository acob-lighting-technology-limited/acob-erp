import { HRAdminDashboard } from "@/app/admin/hr/view"
import { requireDeptScope } from "@/lib/dept/require-dept-scope"

export const metadata: Metadata = { title: "Dept HR" }
import type { Metadata } from "next"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptHrPage({ params }: Props) {
  const { dept_id } = await params
  const scope = await requireDeptScope(dept_id)

  return (
    <HRAdminDashboard
      basePath={`/dept/${dept_id}/hr`}
      title={`${scope.deptName} — HR`}
      description="Manage your team's HR operations."
      backLink={{ href: `/dept/${dept_id}`, label: "Back to Department" }}
      showResourceBooking={false}
    />
  )
}
