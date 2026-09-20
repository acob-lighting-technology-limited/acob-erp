import { Sidebar } from "@/components/sidebar"
import { SidebarContent } from "@/components/sidebar-content"
import { AcoBot } from "@/components/acobot/acobot"
import { MissingAvatarBanner } from "@/components/profile/missing-avatar-banner"
import { createClient } from "@/lib/supabase/server"
import { resolveAdminScope } from "@/lib/admin/rbac"
import { resolveDeptConsoles } from "@/lib/dept/consoles"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { canAccessCbt, getCbtSettings, resolveCbtAccessScope } from "@/lib/cbt-config"
import { redirect } from "next/navigation"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

interface AppLayoutProps {
  children: React.ReactNode
}

export async function AppLayout({ children }: AppLayoutProps) {
  const supabase = await createClient()
  const typedSupabase = supabase as SupabaseClient<Database>
  const { data, error } = await supabase.auth.getUser()

  if (error || !data?.user) {
    redirect("/auth/login")
  }

  // Fetch user profile
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single()
  const adminScope = await resolveAdminScope(typedSupabase, data.user.id)
  const canAccessAdmin = Boolean(adminScope)

  // Resolve every dept console for any user who is a dept lead — pure leads AND
  // admin+lead. Both surfaces are useful independently: admin = global ops,
  // dept = scoped view. A lead may hold several departments.
  const deptConsoles = await resolveDeptConsoles(typedSupabase, profile)
  const { data: isMdDeskMember } = await supabase.rpc("is_md_desk_member")

  // Sitting the test is a grant configured in /admin/settings/cbt, not a role,
  // so resolve it the same way the /cbt layout and middleware do. Without this
  // the nav would offer a link that bounces most people straight back out.
  const cbtDb = getServiceRoleClientOrFallback(supabase)
  const [cbtScope, cbtSettings] = await Promise.all([resolveCbtAccessScope(cbtDb, data.user.id), getCbtSettings(cbtDb)])
  const showCbt = canAccessCbt(cbtScope, cbtSettings)

  const userData = {
    email: data.user.email,
    user_metadata: data.user.user_metadata,
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        user={userData}
        profile={profile || undefined}
        canAccessAdmin={canAccessAdmin}
        deptConsoles={deptConsoles}
        showMdDesk={isMdDeskMember === true}
        showCbt={showCbt}
      />
      <SidebarContent>
        <MissingAvatarBanner hasAvatar={Boolean(profile?.avatar_path)} />
        <div className="pb-[max(var(--fab-safe-area),env(safe-area-inset-bottom))]">{children}</div>
      </SidebarContent>
      <AcoBot userName={profile?.first_name ?? profile?.full_name ?? null} />
    </div>
  )
}
