import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminContextRibbon } from "@/components/admin-context-ribbon"
import { AdminScopeProvider } from "@/components/admin-scope-context"
import { SidebarContent } from "@/components/sidebar-content"
import { AcoBot } from "@/components/acobot/acobot"
import { createClient } from "@/lib/supabase/server"
import { resolveAdminScope } from "@/lib/admin/rbac"
import { resolveDeptConsoles } from "@/lib/dept/consoles"
import { redirect } from "next/navigation"
import type { ClientAdminScope } from "@/components/admin-scope-context"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

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
  }

  // Resolve dept consoles for admin+lead users so "Go to Dept" appears in the
  // admin sidebar dropdown — mirrors the same logic in app-layout.tsx. A lead
  // may hold several departments, so every one of them is listed.
  const deptConsoles = await resolveDeptConsoles(supabase as SupabaseClient<Database>, profile)
  const { data: isMdDeskMember } = await supabase.rpc("is_md_desk_member")

  // "lead" scope visuals apply when the user's view is dept-restricted:
  // either an admin who has toggled into lead mode, OR a pure lead (non-admin
  // with is_department_lead) who is always restricted to their dept.
  const isRestrictedView = scope.scopeMode === "lead" || (!scope.isAdminLike && scope.managedDepartments.length > 0)

  return (
    <div className="admin-shell flex min-h-screen" data-scope={isRestrictedView ? "lead" : "global"}>
      <AdminSidebar
        user={userData}
        profile={profile}
        adminScopeMode={scope.scopeMode}
        deptConsoles={deptConsoles}
        showMdDesk={isMdDeskMember === true}
      />
      <SidebarContent>
        <div className="min-h-screen bg-[var(--admin-content-bg)] pb-[max(var(--fab-safe-area),env(safe-area-inset-bottom))]">
          <AdminContextRibbon
            role={profile.role}
            department={profile.department}
            scopeMode={scope.scopeMode}
            isAdminLike={scope.isAdminLike}
            managedDepartments={scope.managedDepartments}
          />
          <AdminScopeProvider scope={clientScope}>{children}</AdminScopeProvider>
        </div>
      </SidebarContent>
      <AcoBot userName={profile.first_name ?? profile.full_name ?? null} />
    </div>
  )
}
