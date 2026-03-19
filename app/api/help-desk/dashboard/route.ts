import { NextResponse } from "next/server"
import { getAuthContext, HelpDeskProfile, HelpDeskTicketRow, isAdminRole } from "@/lib/help-desk/server"
import { logger } from "@/lib/logger"

const log = logger("help-desk-dashboard")
export const dynamic = "force-dynamic"

type ResolvedHelpDeskTicket = HelpDeskTicketRow & {
  resolved_at: string
  assigned_at: string
}

export async function GET() {
  try {
    const { supabase, user, profile } = await getAuthContext()

    if (!user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let query = supabase.from("help_desk_tickets").select("*")

    const managedDepartments = Array.isArray((profile as HelpDeskProfile).managed_departments)
      ? ((profile as HelpDeskProfile).managed_departments ?? [])
      : []

    if (!isAdminRole(profile.role)) {
      if (profile.is_department_lead) {
        if (managedDepartments.length) {
          // Filter in memory because a ticket may be actionable either by
          // service department ownership or requester-department approval.
        } else {
          query = query.eq("requester_id", user.id)
        }
      } else {
        query = query.or(`requester_id.eq.${user.id},assigned_to.eq.${user.id}`)
      }
    }

    const { data: tickets, error } = await query
    if (error) throw error

    let rows: HelpDeskTicketRow[] = (tickets as HelpDeskTicketRow[] | null) || []
    if (!isAdminRole(profile.role) && profile.is_department_lead && managedDepartments.length) {
      rows = rows.filter(
        (ticket) =>
          managedDepartments.includes(ticket.service_department ?? "") ||
          managedDepartments.includes(ticket.requester_department ?? "")
      )
    }
    const now = Date.now()

    const counts = {
      total: rows.length,
      new: rows.filter((t) => t.status === "new").length,
      assigned: rows.filter((t) => t.status === "assigned").length,
      in_progress: rows.filter((t) => t.status === "in_progress").length,
      pending_approval: rows.filter((t) => t.status === "pending_approval").length,
      resolved: rows.filter((t) => t.status === "resolved").length,
      closed: rows.filter((t) => t.status === "closed").length,
      breached: rows.filter(
        (t) =>
          t.sla_target_at && new Date(t.sla_target_at).getTime() < now && !["resolved", "closed"].includes(t.status)
      ).length,
    }

    const resolvedRows = rows.filter(
      (t): t is ResolvedHelpDeskTicket => typeof t.resolved_at === "string" && typeof t.assigned_at === "string"
    )
    const avgResolutionHours = resolvedRows.length
      ? resolvedRows.reduce((acc: number, t) => {
          return acc + (new Date(t.resolved_at).getTime() - new Date(t.assigned_at).getTime()) / (1000 * 60 * 60)
        }, 0) / resolvedRows.length
      : 0

    const csatRows = rows.filter((t) => typeof t.csat_rating === "number")
    const avgCsat = csatRows.length
      ? csatRows.reduce((acc: number, t) => acc + Number(t.csat_rating || 0), 0) / csatRows.length
      : 0

    return NextResponse.json({
      data: {
        counts,
        kpis: {
          avg_resolution_hours: Number(avgResolutionHours.toFixed(2)),
          avg_csat: Number(avgCsat.toFixed(2)),
          sla_compliance_percent:
            rows.length === 0 ? 100 : Number((((rows.length - counts.breached) / rows.length) * 100).toFixed(2)),
        },
      },
    })
  } catch (error) {
    log.error({ err: String(error) }, "Error in GET /api/help-desk/dashboard:")
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 })
  }
}
