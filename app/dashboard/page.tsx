import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { LogOut, User, FileText, MessageSquare, BarChart3 } from "lucide-react"

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  // Fetch user profile to check if admin
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single()

  const handleLogout = async () => {
    "use server"
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect("/auth/login")
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl p-6">
        {/* Header */}
        <div className="mb-12 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Welcome, {profile?.first_name || "Staff Member"}</h1>
            <p className="mt-2 text-lg text-muted-foreground">ACOB Lighting Technology Limited Staff Portal</p>
          </div>
          <form action={handleLogout}>
            <Button variant="outline" className="gap-2 bg-transparent">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </form>
        </div>

        {/* Main Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Profile Card */}
          <Link href="/profile">
            <div className="group rounded-lg border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-lg cursor-pointer">
              <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3">
                <User className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">My Profile</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                View and edit your personal and professional information
              </p>
              <div className="mt-4 flex items-center text-primary text-sm font-medium group-hover:translate-x-1 transition-transform">
                View Profile →
              </div>
            </div>
          </Link>

          {/* Signature Creator Card */}
          <Link href="/signature">
            <div className="group rounded-lg border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-lg cursor-pointer">
              <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Email Signature</h2>
              <p className="mt-2 text-sm text-muted-foreground">Create and manage your professional email signature</p>
              <div className="mt-4 flex items-center text-primary text-sm font-medium group-hover:translate-x-1 transition-transform">
                Create Signature →
              </div>
            </div>
          </Link>

          {/* Feedback Card */}
          <Link href="/feedback">
            <div className="group rounded-lg border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-lg cursor-pointer">
              <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Feedback</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Submit concerns, complaints, suggestions, or required items
              </p>
              <div className="mt-4 flex items-center text-primary text-sm font-medium group-hover:translate-x-1 transition-transform">
                Submit Feedback →
              </div>
            </div>
          </Link>

          {/* Admin Dashboard Card - Only show if admin */}
          {profile?.is_admin && (
            <Link href="/admin">
              <div className="group rounded-lg border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-lg cursor-pointer md:col-span-2 lg:col-span-1">
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Admin Dashboard</h2>
                <p className="mt-2 text-sm text-muted-foreground">Manage staff members and view system data</p>
                <div className="mt-4 flex items-center text-primary text-sm font-medium group-hover:translate-x-1 transition-transform">
                  Go to Admin →
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* Quick Stats */}
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-6">
            <p className="text-sm font-medium text-muted-foreground">Department</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{profile?.department || "N/A"}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-6">
            <p className="text-sm font-medium text-muted-foreground">Company Role</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{profile?.company_role || "N/A"}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-6">
            <p className="text-sm font-medium text-muted-foreground">Work Location</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{profile?.current_work_location || "N/A"}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
