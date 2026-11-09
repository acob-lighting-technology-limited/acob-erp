import type { Metadata } from "next"
import { KeyRound } from "lucide-react"
import { PageHeader, PageWrapper } from "@/components/layout"
import { AccessRoster } from "@/components/admin/access-roster"

export const metadata: Metadata = { title: "Access" }

export default function AccessPage() {
  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Access"
        description="Every admin, super admin and developer, and whether they can view or edit HR and IT."
        icon={KeyRound}
        backLink={{ href: "/admin/settings", label: "Back to Settings" }}
      />
      <AccessRoster />
    </PageWrapper>
  )
}
