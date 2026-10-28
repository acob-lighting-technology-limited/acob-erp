import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { AdminPmsAttendancePage } from "@/app/admin/pms/attendance/view"

export const metadata: Metadata = { title: "Dept Attendance" }
import type { Metadata } from "next"

interface Props {
  params: Promise<{ dept_id: string }>
}

export default async function DeptPmsAttendancePage({ params }: Props) {
  const { dept_id } = await params
  await requireDeptScope(dept_id)
  return (
    <AdminPmsAttendancePage
      backLinkHref={`/dept/${dept_id}/pms`}
      attendanceBasePath={`/dept/${dept_id}/hr/attendance`}
    />
  )
}
