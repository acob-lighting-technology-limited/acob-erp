import type { Metadata } from "next"
import { KeyRound } from "lucide-react"
import { DataTablePage } from "@/components/ui/data-table"
import { EditAccessManager } from "@/components/admin/edit-access-manager"
import { GRANTABLE_EDIT_ROUTES } from "@/lib/admin/policy-v2"

export const metadata: Metadata = { title: "Access" }

export default function AccessPage() {
  return (
    <DataTablePage
      title="Access"
      description="Who can change things in HR and IT. Everyone with the admin role can view; leads of the owning department edit automatically."
      icon={KeyRound}
    >
      <EditAccessManager mode="grant" routes={GRANTABLE_EDIT_ROUTES as string[]} />
    </DataTablePage>
  )
}
