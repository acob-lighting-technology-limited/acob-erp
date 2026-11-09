import type { Metadata } from "next"
import { AdminPmsAttendancePage } from "./view"

export const metadata: Metadata = { title: "Admin PMS attendance" }

export default function AdminPmsAttendancePageRoute() {
  return <AdminPmsAttendancePage />
}
