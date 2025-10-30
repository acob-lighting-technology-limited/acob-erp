import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default async function AdminSetupPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single()

  if (profile?.is_admin) {
    redirect("/admin")
  }

  const handleMakeAdmin = async () => {
    "use server"
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getUser()

    if (!error && data?.user) {
      await supabase.from("profiles").update({ is_admin: true }).eq("id", data.user.id)
    }

    redirect("/admin")
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Admin Setup</CardTitle>
          <CardDescription>Make yourself an admin to access the admin dashboard</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You are currently logged in as <strong>{data.user.email}</strong>
          </p>

          <p className="text-sm text-muted-foreground">
            Click the button below to grant yourself admin privileges and access the admin dashboard.
          </p>

          <form action={handleMakeAdmin} className="space-y-4">
            <Button type="submit" className="w-full">
              Make Me Admin
            </Button>
          </form>

          <Link href="/dashboard" className="block">
            <Button variant="outline" className="w-full bg-transparent">
              Back to Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
