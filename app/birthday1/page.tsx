import type { Metadata } from "next"
import { requireAdminSectionAccess } from "@/lib/admin/rbac"
import { BirthdayShell } from "../birthday/birthday-spotlight"
import { BirthdayPoster } from "./poster"

// Style option 1 (Poster) — temporary preview route, removed once a style is picked.
export const metadata: Metadata = { title: "Birthday Spotlight · Style 1 | ACOB Lighting Technology Limited" }

export default async function BirthdayStyle1Page() {
  await requireAdminSectionAccess("hr")

  return (
    <BirthdayShell className="bd-poster">
      <BirthdayPoster />
    </BirthdayShell>
  )
}
