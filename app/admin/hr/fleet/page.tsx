import { redirect } from "next/navigation"

/** Canonical route is /admin/hr/resources — same "Resource Booking" feature. */
export default function Page() {
  redirect("/admin/hr/resources")
}
