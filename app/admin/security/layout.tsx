import type { Metadata } from "next"
import { ViewOnlyNotice } from "@/components/admin/view-only-notice"
import { requireAdminSectionAccess } from "@/lib/admin/rbac"

export const metadata: Metadata = {
  title: "Admin Security",
  description: "Security and network activity in the admin dashboard.",
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireAdminSectionAccess("security")
  return (
    <>
      <ViewOnlyNotice route="it.main" />
      {children}
    </>
  )
}
