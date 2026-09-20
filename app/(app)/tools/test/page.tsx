import { redirect } from "next/navigation"

/** Canonical route is /tools/media — "test" was never meant to ship as a URL. */
export default function Page() {
  redirect("/tools/media")
}
