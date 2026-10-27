import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getRequestScope } from "@/lib/admin/api-scope"
import { MailboxesPage } from "./view"

export const metadata: Metadata = {
  title: "Mailboxes",
  description: "Staff mailboxes on cPanel: storage, quotas and who they belong to.",
}

export default async function MailboxesRoute() {
  // Settings is open to department leads for some pages; mailboxes span the whole org.
  const scope = await getRequestScope()
  if (!scope?.isAdminLike) redirect("/admin/settings")
  return <MailboxesPage />
}
