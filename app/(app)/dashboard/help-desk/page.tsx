import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { HelpDeskContent } from "./help-desk-content"

import { logger } from "@/lib/logger"

const log = logger("dashboard-help-desk")


async function getData() {
  const supabase = await createClient()
  const dataClient = getServiceRoleClientOrFallback(supabase as any)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { redirectTo: "/auth/login" as const }
  }

  const { data: tickets, error } = await dataClient
    .from("help_desk_tickets")
    .select("*")
    .or(`requester_id.eq.${user.id},assigned_to.eq.${user.id},created_by.eq.${user.id}`)
    .order("created_at", { ascending: false })

  const { data: profile } = await dataClient
    .from("profiles")
    .select("department, role, is_department_lead")
    .eq("id", user.id)
    .maybeSingle()
  const { data: departmentRows } = await dataClient
    .from("departments")
    .select("name")
    .eq("is_active", true)
    .order("name", { ascending: true })

  if (error) {
    log.error("Error loading help desk tickets:", error)
  }

  return {
    userId: user.id,
    userDepartment: profile?.department || null,
    canReviewPendingApprovals: Boolean(
      profile?.is_department_lead || ["developer", "admin", "super_admin"].includes(String(profile?.role || ""))
    ),
    initialDepartments: (departmentRows || []).map((row: any) => String(row.name || "").trim()).filter(Boolean),
    tickets: tickets || [],
    loadError: error ? `Failed to load help desk tickets: ${error.message}` : null,
  }
}

export default async function PortalHelpDeskPage() {
  const data = await getData()

  if ("redirectTo" in data) {
    redirect(data.redirectTo || "/auth/login")
  }

  return (
    <HelpDeskContent
      userId={data.userId}
      userDepartment={(data as any).userDepartment}
      canReviewPendingApprovals={(data as any).canReviewPendingApprovals}
      initialDepartments={(data as any).initialDepartments || []}
      initialTickets={data.tickets as any}
      initialError={(data as any).loadError}
    />
  )
}
