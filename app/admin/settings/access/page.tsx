import type { Metadata } from "next"
import { KeyRound } from "lucide-react"
import { PageHeader, PageWrapper } from "@/components/layout"
import { EditAccessManager } from "@/components/admin/edit-access-manager"
import { GRANTABLE_EDIT_ROUTES } from "@/lib/admin/policy-v2"

export const metadata: Metadata = { title: "Access" }

export default function AccessPage() {
  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Access"
        description="Who can change things in HR and IT. Everyone with the admin role can view; leads of the owning department edit automatically."
        icon={KeyRound}
        backLink={{ href: "/admin/settings", label: "Back to Settings" }}
      />
      <EditAccessManager mode="grant" routes={GRANTABLE_EDIT_ROUTES as string[]} />
    </PageWrapper>
  )
}
