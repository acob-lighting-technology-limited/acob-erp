import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SignatureCreator } from "@/components/signature-creator"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { resolveAdminScope } from "@/lib/admin/rbac"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

export default async function AdminEmployeeSignaturePage({ params }: { params: { userId: string } }) {
  const supabase = await createClient()
  const typedSupabase = supabase as SupabaseClient<Database>

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  const scope = await resolveAdminScope(typedSupabase, data.user.id)
  if (!scope) {
    redirect("/profile")
  }

  // Fetch the target user's profile
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", params.userId).single()

  if (!profile) {
    redirect("/admin/hr/employees")
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-6xl p-6">
        <div className="mb-8">
          <Link href="/admin/hr/employees" className={cn(buttonVariants({ variant: "ghost" }), "mb-4")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Employees
          </Link>
          <h1 className="text-foreground text-3xl font-bold">
            Email Signature - {profile.first_name} {profile.last_name}
          </h1>
          <p className="text-muted-foreground">View and manage signature for this employee</p>
        </div>

        <SignatureCreator profile={profile} variant="selectable" defaultSelectableMode="anniversary" />
      </div>
    </div>
  )
}
