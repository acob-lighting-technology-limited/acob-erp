import type { Metadata } from "next"
import { requireAdminSectionAccess } from "@/lib/admin/rbac"
import { BirthdayClothesline } from "../birthday/birthday-clothesline"
import { BirthdayShell } from "../birthday/birthday-spotlight"

// Style option 4 (Clothesline on ropes) — temporary preview route, removed once a style is picked.
export const metadata: Metadata = { title: "Birthday Spotlight · Style 4 | ACOB Lighting Technology Limited" }

export default async function BirthdayStyle4Page() {
  await requireAdminSectionAccess("hr")

  return (
    <BirthdayShell className="bd-clothesline">
      <BirthdayClothesline layout="rope" />
    </BirthdayShell>
  )
}
