import { getRequestScope } from "@/lib/admin/api-scope"
import { scopeHoldsAdminRoute } from "@/lib/admin/rbac"
import { redirect } from "next/navigation"
import { LeadsDelegatesView } from "./view"

export const metadata = { title: "Leads & Delegates" }

export default async function LeadsAndDelegatesPage() {
  const scope = await getRequestScope()
  if (!scope?.isAdminLike || scope.scopeMode === "lead" || !scopeHoldsAdminRoute(scope, "hr.main")) {
    redirect("/admin/hr/employees")
  }
  return <LeadsDelegatesView />
}
