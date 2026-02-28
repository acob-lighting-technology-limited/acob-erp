import { NextResponse } from "next/server"
import { canLeadDepartment, getAuthContext, isAdminRole } from "@/lib/help-desk/server"

export async function GET() {
  try {
    const { supabase, user, profile } = await getAuthContext()

    if (!user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let query = supabase.from("help_desk_tickets").select("*")

    const managedDepartments = Array.isArray((profile as any)?.managed_departments)
      ? ((profile as any).managed_departments as string[])
      : []

    if (!isAdminRole(profile.role)) {
      if (profile.role === "lead") {
        if (managedDepartments.length) {
          query = query.in("service_department", managedDepartments)
        } else {
          query = query.eq("requester_id", user.id)
        }
      } else {
        query = query.or(`requester_id.eq.${user.id},assigned_to.eq.${user.id}`)
      }
    }

    const { data: tickets, error } = await query
    if (error) throw error

    const rows = tickets || []
    const now = Date.now()

    const counts = {
      total: rows.length,
      new: rows.filter((t: any) => t.status === "new").length,
      assigned: rows.filter((t: any) => t.status === "assigned").length,
      in_progress: rows.filter((t: any) => t.status === "in_progress").length,
      pending_approval: rows.filter((t: any) => t.status === "pending_approval").length,
      resolved: rows.filter((t: any) => t.status === "resolved").length,
      closed: rows.filter((t: any) => t.status === "closed").length,
      breached: rows.filter(
        (t: any) =>
          t.sla_target_at && new Date(t.sla_target_at).getTime() < now && !["resolved", "closed"].includes(t.status)
      ).length,
    }

    const resolvedRows = rows.filter((t: any) => t.resolved_at && t.assigned_at)
    const avgResolutionHours = resolvedRows.length
      ? resolvedRows.reduce((acc: number, t: any) => {
          return acc + (new Date(t.resolved_at).getTime() - new Date(t.assigned_at).getTime()) / (1000 * 60 * 60)
        }, 0) / resolvedRows.length
      : 0

    const csatRows = rows.filter((t: any) => typeof t.csat_rating === "number")
    const avgCsat = csatRows.length
      ? csatRows.reduce((acc: number, t: any) => acc + Number(t.csat_rating || 0), 0) / csatRows.length
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
    console.error("Error in GET /api/help-desk/dashboard:", error)
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 })
  }
}
