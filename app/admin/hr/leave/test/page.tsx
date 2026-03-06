import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { LeaveFlowTestContent } from "./leave-flow-test-content"

export default async function LeaveFlowTestPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  // Restrict to developer role only
  if (profile?.role !== "developer") redirect("/admin")

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Leave Flow Test Harness</h1>
        <p className="text-muted-foreground text-sm">
          Developer-only tool. Simulates the complete leave approval workflow end-to-end using service-role — no account
          switching required.
        </p>
      </div>
      <LeaveFlowTestContent />
    </div>
  )
}
