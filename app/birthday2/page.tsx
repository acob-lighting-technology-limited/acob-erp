import type { Metadata } from "next"
import { requireAdminSectionAccess } from "@/lib/admin/rbac"
import { BirthdaySpotlight } from "../birthday/birthday-spotlight"

// Style option 2 (Ivory & Gold) — temporary preview route, removed once a style is picked.
export const metadata: Metadata = { title: "Birthday Spotlight · Style 2 | ACOB Lighting Technology Limited" }

export default async function BirthdayStyle2Page() {
  await requireAdminSectionAccess("hr")

  return <BirthdaySpotlight variant={2} />
}
