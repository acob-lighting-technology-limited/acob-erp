import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { AttendanceReportsPage as AdminAttendancePage } from "@/app/admin/hr/attendance/view"

export const metadata: Metadata = { title: "Dept Attendance" }
import type { Metadata } from "next"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptAttendancePage({ params }: Props) {
  const { dept_id } = await params
  const scope = await requireDeptScope(dept_id)
  return <AdminAttendancePage backLinkHref={`/dept/${dept_id}/hr`} lockedDepartment={scope.deptName} />
}
