import { PageHeader, PageWrapper } from "@/components/layout"
import { ScrollText } from "lucide-react"
import { DevLoginLogsContent } from "./dev-login-logs-content"

export default function DevLoginLogsPage() {
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
