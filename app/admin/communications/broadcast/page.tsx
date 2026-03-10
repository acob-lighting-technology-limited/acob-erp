import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CommunicationsComposer } from "@/app/admin/communications/_components/communications-composer"
import { applyAssignableStatusFilter } from "@/lib/workforce/assignment-policy"
import { resolveAdminScope } from "@/lib/admin/rbac"

export default async function CommunicationsBroadcastPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, department")
    .eq("id", user.id)
    .single()

  const scope = await resolveAdminScope(supabase as any, user.id)
  if (!profile || !scope) {
    redirect("/admin")
  }

  const { data: employees } = await applyAssignableStatusFilter(
    supabase
      .from("profiles")
      .select("id, full_name, company_email, additional_email, department, employment_status")
      .or("company_email.not.is.null,additional_email.not.is.null")
      .order("full_name"),
    { allowLegacyNullStatus: false }
  )

  return (
    <CommunicationsComposer
      employees={employees || []}
      mode="communications"
      currentUser={{
        id: user.id,
        full_name: profile?.full_name || null,
        department: profile?.department || null,
      }}
    />
  )
}
