import type { Metadata } from "next"
import { requireAdminSectionAccess } from "@/lib/admin/rbac"

export const metadata: Metadata = {
  title: "Admin Reports",
  description: "Manage reports in the admin dashboard.",
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireAdminSectionAccess("reports")
  return children
}
