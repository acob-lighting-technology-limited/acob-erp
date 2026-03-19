import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SignatureCreator } from "@/components/signature-creator"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { resolveAdminScope } from "@/lib/admin/rbac"

export default async function AdminemployeeSignaturePage({ params }: { params: { userId: string } }) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  const scope = await resolveAdminScope(supabase, data.user.id)
  if (!scope) {
    redirect("/profile")
  }

  // Fetch the target user's profile
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", params.userId).single()

  if (!profile) {
    redirect("/admin/employees")
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-6xl p-6">
        <div className="mb-8">
          <Link href="/admin/employees" className={cn(buttonVariants({ variant: "ghost" }), "mb-4")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Employee
          </Link>
          <h1 className="text-foreground text-3xl font-bold">
            Email Signature - {profile.first_name} {profile.last_name}
          </h1>
          <p className="text-muted-foreground">View and manage signature for this employee member</p>
        </div>

        <SignatureCreator profile={profile} />
      </div>
    </div>
  )
}
