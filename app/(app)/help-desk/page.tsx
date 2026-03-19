import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { HelpDeskContent } from "./help-desk-content"
import type { HelpDeskTicket } from "@/components/help-desk/help-desk-types"

import { logger } from "@/lib/logger"

const log = logger("dashboard-help-desk")

type DepartmentRow = {
  name: string | null
}

type HelpDeskPageData =
  | {
      redirectTo: "/auth/login"
    }
  | {
      userId: string
      userDepartment: string | null
      canReviewPendingApprovals: boolean
      initialDepartments: string[]
      tickets: HelpDeskTicket[]
      loadError: string | null
    }

async function getData() {
  const supabase = await createClient()
  const dataClient = getServiceRoleClientOrFallback(supabase)
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
    initialDepartments: ((departmentRows as DepartmentRow[] | null) || [])
      .map((row) => String(row.name || "").trim())
      .filter(Boolean),
    tickets: (tickets as HelpDeskTicket[] | null) || [],
    loadError: error ? `Failed to load help desk tickets: ${error.message}` : null,
  } satisfies HelpDeskPageData
}

export default async function PortalHelpDeskPage() {
  const data = (await getData()) as HelpDeskPageData

  if ("redirectTo" in data) {
    redirect(data.redirectTo || "/auth/login")
  }

  return (
    <HelpDeskContent
      userId={data.userId}
      userDepartment={data.userDepartment}
      canReviewPendingApprovals={data.canReviewPendingApprovals}
      initialDepartments={data.initialDepartments || []}
      initialTickets={data.tickets}
      initialError={data.loadError}
    />
  )
}
