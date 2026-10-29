import type { Metadata } from "next"
import { requireAdminSectionAccess } from "@/lib/admin/rbac"

export const metadata: Metadata = {
  title: "Admin Settings",
  description: "Manage settings in the admin dashboard.",
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireAdminSectionAccess("settings")
  return children
}
