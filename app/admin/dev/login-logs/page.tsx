import { ScrollText } from "lucide-react"
import { requireAdminSectionAccess } from "@/lib/admin/rbac"
import { DevLoginLogsContent } from "./dev-login-logs-content"
import { DataTablePage } from "@/components/ui/data-table"

export default async function DevLoginLogsPage() {
  await requireAdminSectionAccess("dev")

  return (
    <DataTablePage
      title="Developer Login Logs"
      description="Monitor successful sign-ins with network and actor context."
      icon={ScrollText}
      backLink={{ href: "/admin/dev", label: "Back to DEV" }}
    >
      <DevLoginLogsContent />
    </DataTablePage>
  )
}
