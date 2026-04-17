import { redirect } from "next/navigation"
import { getRequestScope } from "@/lib/admin/api-scope"

/**
 * Server-level guard for the CBT section.
 * CBT (question management, cycle scores) is a super_admin / developer concern —
 * department leads have no business creating or accessing organisation-wide tests.
 */
export default async function CbtLayout({ children }: { children: React.ReactNode }) {
  const scope = await getRequestScope()

  // Block if: no scope, or user is a lead / admin in lead mode
  const isGlobalAdmin = scope?.isAdminLike === true && scope.scopeMode !== "lead"
  if (!isGlobalAdmin) {
    redirect("/admin/hr/pms")
  }

  return <>{children}</>
}
