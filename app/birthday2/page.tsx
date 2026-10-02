import type { Metadata } from "next"
import { requireAdminSectionAccess } from "@/lib/admin/rbac"
import { BirthdayShell } from "../birthday/birthday-spotlight"
import { BirthdayMagazine } from "./magazine"

// Style option 2 (Magazine) — temporary preview route, removed once a style is picked.
export const metadata: Metadata = { title: "Birthday Spotlight · Style 2 | ACOB Lighting Technology Limited" }

export default async function BirthdayStyle2Page() {
  await requireAdminSectionAccess("hr")

  return (
    <BirthdayShell className="bd-magazine">
      <BirthdayMagazine />
    </BirthdayShell>
  )
}
