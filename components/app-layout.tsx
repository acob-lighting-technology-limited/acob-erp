import { Sidebar } from "@/components/sidebar"
import { SidebarContent } from "@/components/sidebar-content"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

interface AppLayoutProps {
  children: React.ReactNode
}

export async function AppLayout({ children }: AppLayoutProps) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data?.user) {
    redirect("/auth/login")
  }

  // Fetch user profile
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single()
  const canAccessAdmin = !!profile?.role && ["super_admin", "admin", "lead"].includes(profile.role)

  const userData = {
    email: data.user.email,
    user_metadata: data.user.user_metadata,
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar user={userData} profile={profile || undefined} canAccessAdmin={canAccessAdmin} />
      <SidebarContent>{children}</SidebarContent>
    </div>
  )
}
