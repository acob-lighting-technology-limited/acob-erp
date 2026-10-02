import type { Metadata } from "next"
import { requireAdminSectionAccess } from "@/lib/admin/rbac"
import { BirthdayShell } from "../birthday/birthday-spotlight"
import { BirthdaySlideshow } from "./slideshow"

// Style option 5 (Slideshow) — temporary preview route, removed once a style is picked.
export const metadata: Metadata = { title: "Birthday Spotlight · Style 5 | ACOB Lighting Technology Limited" }

export default async function BirthdayStyle5Page() {
  await requireAdminSectionAccess("hr")

  return (
    <BirthdayShell className="bd-slideshow">
      <BirthdaySlideshow />
    </BirthdayShell>
  )
}
