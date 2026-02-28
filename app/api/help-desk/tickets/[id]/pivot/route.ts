import { NextRequest, NextResponse } from "next/server"
import {
  appendAuditLog,
  appendHelpDeskEvent,
  canLeadDepartment,
  getAuthContext,
  isAdminRole,
} from "@/lib/help-desk/server"
import { sendHelpDeskMail } from "@/lib/help-desk/mailer"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { supabase, user, profile } = await getAuthContext()

    if (!user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { reason } = await request.json()
    const pivotReason = reason ? String(reason).trim() : "Procurement required to proceed"

    const { data: ticket, error: ticketError } = await supabase
      .from("help_desk_tickets")
      .select("*")
      .eq("id", params.id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    const canPivot =
      ticket.assigned_to === user.id ||
      isAdminRole(profile.role) ||
      canLeadDepartment(profile, ticket.service_department)

    if (!canPivot) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const now = new Date().toISOString()

    const { data: updated, error: updateError } = await supabase
      .from("help_desk_tickets")
      .update({
        request_type: "procurement",
        approval_required: true,
        pivoted_to_procurement: true,
        procurement_reason: pivotReason,
        status: "pending_approval",
        paused_at: now,
      })
      .eq("id", ticket.id)
      .select("*")
      .single()

    if (updateError) throw updateError

    const { data: existingApprovals } = await supabase
      .from("help_desk_approvals")
      .select("id")
      .eq("ticket_id", ticket.id)

    if (!existingApprovals?.length) {
      await supabase.from("help_desk_approvals").insert([
        { ticket_id: ticket.id, approval_stage: "department_lead", status: "pending" },
        { ticket_id: ticket.id, approval_stage: "head_corporate_services", status: "pending" },
        { ticket_id: ticket.id, approval_stage: "managing_director", status: "pending" },
      ])
    }

    const { data: profiles } = await supabase.from("profiles").select("id, role, department, lead_departments")

    const potentialApprovers = (profiles || []).filter((p: any) => {
      if (p.role === "lead") {
        return (
          (p.lead_departments || []).includes(ticket.service_department) || p.department === ticket.service_department
        )
      }
      if (["admin", "super_admin"].includes(p.role) && p.department === "Admin & HR") return true
      if (["admin", "super_admin"].includes(p.role) && p.department === "Executive Management") return true
      if (p.role === "super_admin") return true
      return false
    })

    try {
      await sendHelpDeskMail({
        userIds: potentialApprovers.map((p: any) => p.id),
        subject: `Procurement Pivot: ${ticket.ticket_number}`,
        title: "Ticket Requires Procurement Approval",
        message: `${ticket.title} has been moved to procurement flow and is awaiting approval actions.`,
        ticketNumber: ticket.ticket_number,
        ctaPath: "/admin/help-desk",
      })
    } catch (mailError) {
      console.error("Help desk mail error (pivot):", mailError)
    }

    await appendHelpDeskEvent({
      ticketId: ticket.id,
      actorId: user.id,
      eventType: "pivot_to_procurement",
      oldStatus: ticket.status,
      newStatus: "pending_approval",
      details: { reason: pivotReason },
    })

    await appendAuditLog({
      actorId: user.id,
      action: "help_desk_ticket_pivoted_to_procurement",
      entityId: ticket.id,
      oldValues: { request_type: ticket.request_type, status: ticket.status },
      newValues: { request_type: "procurement", status: "pending_approval", procurement_reason: pivotReason },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("Error in POST /api/help-desk/tickets/[id]/pivot:", error)
    return NextResponse.json({ error: "Failed to pivot ticket" }, { status: 500 })
  }
}
