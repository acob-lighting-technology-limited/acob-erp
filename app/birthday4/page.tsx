import type { Metadata } from "next"
import { requireAdminSectionAccess } from "@/lib/admin/rbac"
import { BirthdaySpotlight } from "../birthday/birthday-spotlight"

// Style option 4 (Stage Spotlight) — temporary preview route, removed once a style is picked.
export const metadata: Metadata = { title: "Birthday Spotlight · Style 4 | ACOB Lighting Technology Limited" }

export default async function BirthdayStyle4Page() {
  await requireAdminSectionAccess("hr")

  return <BirthdaySpotlight variant={4} />
}
