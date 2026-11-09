import type { Metadata } from "next"
import { ViewOnlyNotice } from "@/components/admin/view-only-notice"
import { requireAdminSectionAccess } from "@/lib/admin/rbac"

export const metadata: Metadata = {
  title: "Admin HR",
  description: "Manage HR in the admin dashboard.",
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireAdminSectionAccess("hr")
  return (
    <>
      <ViewOnlyNotice route="hr.main" />
      {children}
    </>
  )
}
