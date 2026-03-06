import { redirect } from "next/navigation"

export default async function DevMaintenancePage() {
  redirect("/admin/settings/maintenance")
}
