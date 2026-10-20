import { DataTablePage } from "@/components/ui/data-table"
import { requireAdminSectionAccess } from "@/lib/admin/rbac"
import { DevImpersonationContent } from "./impersonation-content"

import { layout as tablePageLayout } from "./_layout"

export default async function DevImpersonationPage() {
  await requireAdminSectionAccess("dev")

  return (
    <DataTablePage
      layout={tablePageLayout}
      title="Session Impersonation"
      description="Developer-only account switching for flow testing."
      backLink={{ href: "/admin/dev", label: "Back to DEV" }}
    >
      <DevImpersonationContent />
    </DataTablePage>
  )
}
