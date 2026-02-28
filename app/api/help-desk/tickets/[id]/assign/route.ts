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

    const { assigned_to } = await request.json()

    if (!assigned_to) {
      return NextResponse.json({ error: "assigned_to is required" }, { status: 400 })
    }

    const { data: ticket, error: ticketError } = await supabase
      .from("help_desk_tickets")
      .select("*")
      .eq("id", params.id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    const canAssign = isAdminRole(profile.role) || canLeadDepartment(profile, ticket.service_department)
    if (!canAssign) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const now = new Date().toISOString()

    const { data: updated, error: updateError } = await supabase
      .from("help_desk_tickets")
      .update({
        assigned_to,
        assigned_by: user.id,
        status: ticket.status === "new" ? "assigned" : ticket.status,
        assigned_at: ticket.assigned_at ?? now,
      })
      .eq("id", ticket.id)
      .select("*")
      .single()

    if (updateError) throw updateError

    await appendHelpDeskEvent({
      ticketId: ticket.id,
      actorId: user.id,
      eventType: "ticket_assigned",
      oldStatus: ticket.status,
      newStatus: updated.status,
      details: { from: ticket.assigned_to, to: assigned_to },
    })

    await appendAuditLog({
      actorId: user.id,
      action: "help_desk_ticket_assigned",
      entityId: ticket.id,
      oldValues: { assigned_to: ticket.assigned_to },
      newValues: { assigned_to },
    })

    await supabase.rpc("create_notification", {
      p_user_id: assigned_to,
      p_type: "task_assigned",
      p_category: "tasks",
      p_title: "Help desk ticket assigned",
      p_message: `${ticket.ticket_number} - ${ticket.title}`,
      p_priority: ticket.priority === "urgent" ? "urgent" : ticket.priority === "high" ? "high" : "normal",
      p_link_url: "/portal/help-desk",
      p_actor_id: user.id,
      p_entity_type: "help_desk_ticket",
      p_entity_id: ticket.id,
      p_rich_content: { service_department: ticket.service_department, priority: ticket.priority },
    })

    try {
      await sendHelpDeskMail({
        userIds: [assigned_to],
        subject: `Help Desk Assignment: ${ticket.ticket_number}`,
        title: "Ticket Assigned To You",
        message: `${ticket.title} has been assigned to you for execution.`,
        ticketNumber: ticket.ticket_number,
      })
    } catch (mailError) {
      console.error("Help desk mail error (assign):", mailError)
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("Error in POST /api/help-desk/tickets/[id]/assign:", error)
    return NextResponse.json({ error: "Failed to assign ticket" }, { status: 500 })
  }
}
