import { PageHeader, PageWrapper } from "@/components/layout"
import { ScrollText } from "lucide-react"
import { DevLoginLogsContent } from "./dev-login-logs-content"
import { requireAdminSectionAccess } from "@/lib/admin/rbac"

export default async function DevLoginLogsPage() {
  await requireAdminSectionAccess("dev")

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Developer Login Logs"
        description="Monitor successful sign-ins with network and actor context"
        icon={ScrollText}
        backLink={{ href: "/admin/dev", label: "Back to DEV" }}
      />
      <DevLoginLogsContent />
    </PageWrapper>
  )
}
