import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getRequestScope } from "@/lib/admin/api-scope"
import { scopeHoldsAdminRoute } from "@/lib/admin/rbac"
import { MailboxesPage } from "./view"

export const metadata: Metadata = {
  title: "Mailboxes",
  description: "Staff mailboxes on cPanel: storage, quotas and who they belong to.",
}

export default async function MailboxesRoute() {
  // Mailboxes span the whole org and belong to IT: viewing needs the IT route (it.main).
  const scope = await getRequestScope()
  if (!scope || !scopeHoldsAdminRoute(scope, "it.main")) redirect("/admin")
  return <MailboxesPage />
}
