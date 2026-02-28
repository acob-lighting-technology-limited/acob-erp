import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminContextRibbon } from "@/components/admin-context-ribbon"
import { SidebarContent } from "@/components/sidebar-content"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

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

  // Check if user has admin privileges
  // Role hierarchy: super_admin > admin > lead > employee > visitor
  // Only super_admin, admin, and lead can access admin panel
  if (!profile || !["super_admin", "admin", "lead"].includes(profile.role)) {
    redirect("/dashboard")
  }

  const userData = {
    email: data.user.email,
    user_metadata: data.user.user_metadata,
  }

  return (
    <div className="admin-shell flex min-h-screen">
      <AdminSidebar user={userData} profile={profile} />
      <SidebarContent>
        <div className="min-h-screen bg-[var(--admin-content-bg)]">
          <AdminContextRibbon role={profile.role} department={profile.department} />
          {children}
        </div>
      </SidebarContent>
    </div>
  )
}
