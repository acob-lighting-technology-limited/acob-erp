import { requireAdminSectionAccess } from "@/lib/admin/rbac"
import { BirthdayClothesline } from "./birthday-clothesline"
import type { Metadata } from "next"
import { BirthdayShell } from "./birthday-spotlight"

export const metadata: Metadata = { title: "Birthday" }

export default async function BirthdayPage() {
  // HR-access admins only — this page fetches employee birthdays and photos.
  await requireAdminSectionAccess("hr")

  return (
    <BirthdayShell className="bd-clothesline">
      <BirthdayClothesline layout="cards" />
    </BirthdayShell>
  )
}
