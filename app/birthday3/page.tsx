import type { Metadata } from "next"
import { requireAdminSectionAccess } from "@/lib/admin/rbac"
import { BirthdaySpotlight } from "../birthday/birthday-spotlight"

// Style option 3 (Minimal Noir) — temporary preview route, removed once a style is picked.
export const metadata: Metadata = { title: "Birthday Spotlight · Style 3 | ACOB Lighting Technology Limited" }

export default async function BirthdayStyle3Page() {
  await requireAdminSectionAccess("hr")

  return <BirthdaySpotlight variant={3} />
}
