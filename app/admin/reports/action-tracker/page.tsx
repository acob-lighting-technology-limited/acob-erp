import { Suspense } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ActionTrackerContent } from "./action-tracker-content"

export default async function ActionTrackerPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  // Get user profile to check if employee/admin
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (!profile || !["super_admin", "admin"].includes(profile.role)) {
    redirect("/dashboard")
  }

  // Fetch departments for filtering
  const { data: employeeData } = await supabase.from("profiles").select("department").not("department", "is", null)

  const departments = Array.from(new Set(employeeData?.map((s: any) => s.department).filter(Boolean))) as string[]
  departments.sort()

  return (
    <Suspense fallback={<div className="flex justify-center py-20">Loading Tracker...</div>}>
      <ActionTrackerContent initialDepartments={departments} />
    </Suspense>
  )
}
