import { redirect } from "next/navigation"

/** Canonical route is /admin/hr/offices-rooms, matching the "Offices & Rooms" label. */
export default function Page() {
  redirect("/admin/hr/offices-rooms")
}
