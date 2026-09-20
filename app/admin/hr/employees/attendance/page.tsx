import { redirect } from "next/navigation"

/** Canonical route is /admin/hr/attendance, which owns the hr.attendance key. */
export default function Page() {
  redirect("/admin/hr/attendance")
}
