import { redirect } from "next/navigation"

// The MD's Desk sidebar group opens on Overview. Overview has its own path so the
// sidebar's prefix-based highlighting does not mark it active on every sub-page.
export default function MdDeskIndexPage() {
  redirect("/md-desk/overview")
}
