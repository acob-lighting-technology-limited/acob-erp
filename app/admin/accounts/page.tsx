import { requireAdminSectionAccess } from "@/lib/admin/rbac"
import { AdminAccountsPage } from "./view"

import type { Metadata } from "next"

export const metadata: Metadata = { title: "Admin Accounts" }

export default async function AccountsDashboard() {
  await requireAdminSectionAccess("accounts")

  return <AdminAccountsPage />
}
