import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Settings, Users, Building2, Shield, ArrowLeft } from "lucide-react"
import Link from "next/link"

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
    <div className="from-background via-background to-muted/20 min-h-screen w-full overflow-x-hidden bg-gradient-to-br">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Link href="/admin" className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold sm:gap-3 sm:text-3xl">
                <Settings className="text-primary h-6 w-6 sm:h-8 sm:w-8" />
                Settings
              </h1>
            </div>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">Manage users, roles, and company settings</p>
          </div>
        </div>

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
              <Link href="/admin/settings/users">
                <Button className="w-full">Manage Users</Button>
              </Link>
              <Link href="/admin/settings/users/invite">
                <Button className="w-full" variant="outline">
                  Invite User
                </Button>
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
              <Link href="/admin/settings/roles">
                <Button className="w-full">Manage Roles</Button>
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
              <Link href="/admin/settings/company">
                <Button className="w-full">Company Profile</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
