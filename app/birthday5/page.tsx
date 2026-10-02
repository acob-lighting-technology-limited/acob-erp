import type { Metadata } from "next"
import { requireAdminSectionAccess } from "@/lib/admin/rbac"
import { BirthdaySpotlight } from "../birthday/birthday-spotlight"

// Style option 5 (Green Panel) — temporary preview route, removed once a style is picked.
export const metadata: Metadata = { title: "Birthday Spotlight · Style 5 | ACOB Lighting Technology Limited" }

export default async function BirthdayStyle5Page() {
  await requireAdminSectionAccess("hr")

  return <BirthdaySpotlight variant={5} />
}
