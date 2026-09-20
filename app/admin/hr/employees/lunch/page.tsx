import { redirect } from "next/navigation"

/** Canonical route is /admin/hr/lunch, next to the view it renders. */
export default function Page() {
  redirect("/admin/hr/lunch")
}
