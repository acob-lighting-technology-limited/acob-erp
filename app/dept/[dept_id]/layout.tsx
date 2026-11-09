import type { Metadata } from "next"
import { DeptLayout } from "@/components/dept-layout"
import { AcoBot } from "@/components/acobot/acobot"
import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { DEPT_DELEGABLE_PAGES } from "@/lib/dept/delegated-pages"
import { formatWATDate } from "@/lib/utils/date"
import { ErrorBoundary } from "@/components/error-boundary"
import type { ClientAdminScope } from "@/components/admin-scope-context"
import type { UserRole } from "@/types/database"

export const metadata: Metadata = {
  title: "My Department",
  description: "Department lead console — manage your team, approvals, and operations.",
}

interface DeptLayoutPageProps {
  children: React.ReactNode
  params: Promise<{ dept_id: string }>
}

export default async function DeptLayoutPage({ children, params }: DeptLayoutPageProps) {
  const { dept_id } = await params
  const scope = await requireDeptScope(dept_id)

  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  const { data: profile } = authData?.user
    ? await supabase
        .from("profiles")
        .select("id, first_name, last_name, department, role, is_department_lead, admin_routes, lead_departments")
        .eq("id", authData.user.id)
        .single()
    : { data: null }

  const userData = authData?.user
    ? { email: authData.user.email, user_metadata: authData.user.user_metadata }
    : undefined

  /**
   * Synthesise a ClientAdminScope from DeptScope.
   * scopeMode is always "lead" — the dept surface is always dept-scoped.
   */
  const clientScope: ClientAdminScope = {
    userId: scope.userId,
    role: scope.role,
    scopeMode: "lead",
    managedDepartments: [scope.deptName],
    managedDepartmentIds: [scope.deptId],
    isDepartmentLead: true,
    isAdminLike: scope.isAdminLike,
    delegated: Boolean(scope.delegation),
  }

  // Profile shape for AdminSidebar — augment with lead info so the sidebar
  // filters nav items correctly for this user's role.
  const sidebarProfile = profile
    ? {
        id: profile.id,
        first_name: profile.first_name ?? undefined,
        last_name: profile.last_name ?? undefined,
        department: scope.deptName, // always show the dept this console is for
        role: (profile.role ?? "employee") as UserRole,
        is_department_lead: true,
        admin_routes: (profile.admin_routes as string[] | null) ?? null,
        lead_departments: [scope.deptName],
      }
    : undefined

  const delegation = scope.delegation
  let banner: React.ReactNode = null
  if (delegation) {
    const { data: from } = await getServiceRoleClientOrFallback(supabase)
      .from("profiles")
      .select("full_name, first_name, last_name")
      .eq("id", delegation.fromUserId)
      .maybeSingle<{ full_name: string | null; first_name: string | null; last_name: string | null }>()
    const fromName =
      from?.full_name?.trim() || [from?.first_name, from?.last_name].filter(Boolean).join(" ") || "the lead"
    const labels = DEPT_DELEGABLE_PAGES.filter((page) => delegation.pages.includes(page.key)).map((page) => page.label)
    banner = (
      <div className="bg-muted/50 text-muted-foreground mx-4 mt-4 rounded-lg border p-3 text-sm md:mx-6">
        You are acting for <span className="text-foreground font-medium">{fromName}</span> in {scope.deptName} until{" "}
        {formatWATDate(delegation.validUntil)}. You can use: {labels.join(", ")}.
      </div>
    )
  }

  return (
    // AcoBot renders inside DeptLayout (it is fixed-positioned, so this does not
    // affect layout) so that it sits within .admin-shell and picks up the dept
    // console's navy accent instead of the global green.
    <DeptLayout
      scope={clientScope}
      user={userData}
      profile={sidebarProfile}
      deptName={scope.deptName}
      delegatedPages={delegation?.pages}
      banner={banner}
    >
      <ErrorBoundary>{children}</ErrorBoundary>
      <AcoBot userName={profile?.first_name ?? null} />
    </DeptLayout>
  )
}
