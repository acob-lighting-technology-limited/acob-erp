import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Settings, Users, Building2, Shield } from "lucide-react"
import Link from "next/link"
import { PageHeader, PageWrapper } from "@/components/layout"
import { MaintenanceToggle } from "@/components/admin/maintenance-toggle"

export default async function AdminSettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  // Check if user is admin
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (!profile || !["super_admin", "admin"].includes(profile.role)) {
    redirect("/dashboard")
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Settings"
        description="Manage users, roles, and company settings"
        icon={Settings}
        backLink={{ href: "/admin", label: "Back to Admin" }}
      />

      {/* Settings Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </CardTitle>
            <CardDescription>Manage user accounts and permissions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/settings/users" className={cn(buttonVariants({ variant: "default" }), "w-full")}>
              Manage Users
            </Link>
            <Link href="/admin/settings/users/invite" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
              Invite User
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Roles & Permissions
            </CardTitle>
            <CardDescription>Configure user roles and access levels</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/settings/roles" className={cn(buttonVariants({ variant: "default" }), "w-full")}>
              Manage Roles
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Settings
            </CardTitle>
            <CardDescription>Configure company information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/settings/company" className={cn(buttonVariants({ variant: "default" }), "w-full")}>
              Company Profile
            </Link>
          </CardContent>
        </Card>

        {/* System Settings */}
        <Card className="md:col-span-2 lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              System Settings
            </CardTitle>
            <CardDescription>Global system configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <MaintenanceToggle />
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  )
}
