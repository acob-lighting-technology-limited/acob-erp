import { redirect } from "next/navigation"

/** Canonical route is /requisitions — the label was always plural. */
export default function Page() {
  redirect("/requisitions")
}
