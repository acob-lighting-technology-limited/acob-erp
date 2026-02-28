import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Settings, Users, Building2, Shield } from "lucide-react"
import Link from "next/link"
import { PageHeader, PageWrapper } from "@/components/layout"
import { MaintenanceToggle } from "@/components/admin/maintenance-toggle"
import { resolveAdminScope } from "@/lib/admin/rbac"

export default async function AdminSettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  const scope = await resolveAdminScope(supabase as any, user.id)
  if (!scope) {
    redirect("/dashboard")
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Settings"
        description={
          scope.isAdminLike
            ? "Manage users, roles, and company settings"
            : "Manage department-scoped settings and access controls"
        }
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
            <CardDescription>
              {scope.isAdminLike ? "Configure company information" : "View company information (read-only for leads)"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/settings/company" className={cn(buttonVariants({ variant: "default" }), "w-full")}>
              Company Profile
            </Link>
          </CardContent>
        </Card>

        {/* System Settings */}
        {scope.isAdminLike && (
          <Card>
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
        )}
      </div>
    </PageWrapper>
  )
}
