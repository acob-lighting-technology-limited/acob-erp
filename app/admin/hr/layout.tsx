import type { Metadata } from "next"
import { EditAccessBoundary } from "@/components/admin/edit-access-boundary"
import { requireAdminSectionAccess } from "@/lib/admin/rbac"

export const metadata: Metadata = {
  title: "Admin HR",
  description: "Manage HR in the admin dashboard.",
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireAdminSectionAccess("hr")
  return <EditAccessBoundary route="hr.main">{children}</EditAccessBoundary>
}
