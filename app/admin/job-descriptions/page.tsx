import { redirect } from "next/navigation"

/** Canonical route is /admin/hr/job-descriptions — it is an HR surface. */
export default function Page() {
  redirect("/admin/hr/job-descriptions")
}
