import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SignatureCreator } from "@/components/signature-creator"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default async function AdminStaffSignaturePage({ params }: { params: { userId: string } }) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  // Check if user is admin
  const { data: me } = await supabase.from("profiles").select("is_admin, role").eq("id", data.user.id).single()
  if (!me?.is_admin && !['super_admin', 'admin'].includes(me?.role || '')) {
    redirect("/dashboard")
  }

  // Fetch the target user's profile
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", params.userId).single()

  if (!profile) {
    redirect("/admin/staff")
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl p-6">
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/admin/staff">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Staff
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-foreground">
            Email Signature - {profile.first_name} {profile.last_name}
          </h1>
          <p className="text-muted-foreground">View and manage signature for this staff member</p>
        </div>

        <SignatureCreator profile={profile} />
      </div>
    </div>
  )
}
