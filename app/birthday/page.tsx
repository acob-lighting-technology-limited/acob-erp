import { requireAdminSectionAccess } from "@/lib/admin/rbac"
import { BirthdayDecor } from "./birthday-decor"
import { BirthdayExplorer } from "./birthday-explorer"

export default async function BirthdayPage() {
  // HR-access admins only — this page fetches employee birthdays and photos.
  await requireAdminSectionAccess("hr")

  return (
    <main className="birthday-page">
      <BirthdayDecor />

      <section className="birthday-hero">
        <BirthdayExplorer />
      </section>
    </main>
  )
}
