import { DataTablePage } from "@/components/ui/data-table"
import { requireAdminSectionAccess } from "@/lib/admin/rbac"
import { DevImpersonationContent } from "./impersonation-content"

import type { Metadata } from "next"

export const metadata: Metadata = { title: "Admin Impersonation" }

export default async function DevImpersonationPage() {
  await requireAdminSectionAccess("dev")

  return (
    <DataTablePage title="Impersonation" description="Developer-only account switching for flow testing.">
      <DevImpersonationContent />
    </DataTablePage>
  )
}
