import { requireAdminSectionAccess } from "@/lib/admin/rbac"
import { BirthdaySpotlight } from "./birthday-spotlight"

export default async function BirthdayPage() {
  // HR-access admins only — this page fetches employee birthdays and photos.
  await requireAdminSectionAccess("hr")

  return <BirthdaySpotlight />
}
