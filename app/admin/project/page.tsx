import { redirect } from "next/navigation"

/** Canonical route is /admin/projects — the console was always labelled plural. */
export default function Page() {
  redirect("/admin/projects")
}
