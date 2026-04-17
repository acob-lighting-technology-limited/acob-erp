import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminContextRibbon } from "@/components/admin-context-ribbon"
import { AdminScopeProvider } from "@/components/admin-scope-context"
import { SidebarContent } from "@/components/sidebar-content"
import { createClient } from "@/lib/supabase/server"
import { resolveAdminScope } from "@/lib/admin/rbac"
import { redirect } from "next/navigation"
import type { ClientAdminScope } from "@/components/admin-scope-context"

interface AdminLayoutProps {
  children: React.ReactNode
}

export async function AdminLayout({ children }: AdminLayoutProps) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data?.user) {
    redirect("/auth/login")
  }

  // Fetch user profile with role
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single()

  const scope = await resolveAdminScope(supabase, data.user.id)
  if (!profile || !scope) {
    redirect("/profile")
  }

  const userData = {
    email: data.user.email,
    user_metadata: data.user.user_metadata,
  }

  // Serialisable subset only — no functions, no Supabase client
  const clientScope: ClientAdminScope = {
    userId: scope.userId,
    role: scope.role,
    scopeMode: scope.scopeMode,
    managedDepartments: scope.managedDepartments,
    managedDepartmentIds: scope.managedDepartmentIds,
    isDepartmentLead: scope.isDepartmentLead,
    isAdminLike: scope.isAdminLike,
    canToggleLeadScope: scope.canToggleLeadScope,
  }

  // "lead" scope visuals apply when the user's view is dept-restricted:
  // either an admin who has toggled into lead mode, OR a pure lead (non-admin
  // with is_department_lead) who is always restricted to their dept.
  const isRestrictedView = scope.scopeMode === "lead" || (!scope.isAdminLike && scope.managedDepartments.length > 0)

  return (
    <div className="admin-shell flex min-h-screen" data-scope={isRestrictedView ? "lead" : "global"}>
      <AdminSidebar user={userData} profile={profile} adminScopeMode={scope.scopeMode} />
      <SidebarContent>
        <div className="min-h-screen bg-[var(--admin-content-bg)]">
          <AdminContextRibbon
            role={profile.role}
            department={profile.department}
            scopeMode={scope.scopeMode}
            isAdminLike={scope.isAdminLike}
            canToggleLeadScope={scope.canToggleLeadScope}
            managedDepartments={scope.managedDepartments}
          />
          <AdminScopeProvider scope={clientScope}>{children}</AdminScopeProvider>
        </div>
      </SidebarContent>
    </div>
  )
}
