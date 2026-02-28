import { NextRequest, NextResponse } from "next/server"
import {
  HELP_DESK_STATUSES,
  appendAuditLog,
  appendHelpDeskEvent,
  canLeadDepartment,
  getAuthContext,
  isAdminRole,
} from "@/lib/help-desk/server"
import { sendHelpDeskMail } from "@/lib/help-desk/mailer"

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { supabase, user, profile } = await getAuthContext()

    if (!user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: ticket, error } = await supabase.from("help_desk_tickets").select("*").eq("id", params.id).single()

    if (error || !ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    const canView =
      isAdminRole(profile.role) ||
      canLeadDepartment(profile, ticket.service_department) ||
      ticket.requester_id === user.id ||
      ticket.assigned_to === user.id

    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const [commentsRes, approvalsRes, eventsRes] = await Promise.all([
      supabase
        .from("help_desk_comments")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("help_desk_approvals")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("requested_at", { ascending: true }),
      supabase.from("help_desk_events").select("*").eq("ticket_id", ticket.id).order("created_at", { ascending: true }),
    ])

    return NextResponse.json({
      data: {
        ticket,
        comments: commentsRes.data || [],
        approvals: approvalsRes.data || [],
        events: eventsRes.data || [],
      },
    })
  } catch (error) {
    console.error("Error in GET /api/help-desk/tickets/[id]:", error)
    return NextResponse.json({ error: "Failed to fetch ticket" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { supabase, user, profile } = await getAuthContext()

    if (!user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: ticket, error: ticketError } = await supabase
      .from("help_desk_tickets")
      .select("*")
      .eq("id", params.id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    const body = await request.json()
    const nextStatus = body?.status ? String(body.status) : null
    const csatRating = body?.csat_rating
    const csatFeedback = body?.csat_feedback ? String(body.csat_feedback) : null

    const canManage =
      isAdminRole(profile.role) ||
      canLeadDepartment(profile, ticket.service_department) ||
      ticket.assigned_to === user.id ||
      ticket.requester_id === user.id

    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const updates: Record<string, unknown> = {}

    if (nextStatus) {
      if (!HELP_DESK_STATUSES.includes(nextStatus as any)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 })
      }

      updates.status = nextStatus
      if (nextStatus === "in_progress" && !ticket.started_at) {
        updates.started_at = new Date().toISOString()
      }
      if (nextStatus === "resolved") {
        updates.resolved_at = new Date().toISOString()
      }
      if (nextStatus === "closed") {
        updates.closed_at = new Date().toISOString()
      }
    }

    if (typeof csatRating === "number") {
      if (ticket.requester_id !== user.id) {
        return NextResponse.json({ error: "Only requester can rate a ticket" }, { status: 403 })
      }
      if (csatRating < 1 || csatRating > 5) {
        return NextResponse.json({ error: "CSAT rating must be between 1 and 5" }, { status: 400 })
      }
      updates.csat_rating = csatRating
      updates.csat_feedback = csatFeedback
    }

    const { data: updated, error: updateError } = await supabase
      .from("help_desk_tickets")
      .update(updates)
      .eq("id", params.id)
      .select("*")
      .single()

    if (updateError) throw updateError

    await appendHelpDeskEvent({
      ticketId: ticket.id,
      actorId: user.id,
      eventType: "ticket_updated",
      oldStatus: ticket.status,
      newStatus: updated.status,
      details: updates,
    })

    await appendAuditLog({
      actorId: user.id,
      action: "help_desk_ticket_updated",
      entityId: ticket.id,
      oldValues: { status: ticket.status, csat_rating: ticket.csat_rating },
      newValues: { status: updated.status, csat_rating: updated.csat_rating },
    })

    if (nextStatus === "resolved") {
      await supabase.rpc("create_notification", {
        p_user_id: ticket.requester_id,
        p_type: "task_completed",
        p_category: "tasks",
        p_title: "Ticket resolved",
        p_message: `${ticket.ticket_number} has been resolved. Please review and rate the service.`,
        p_priority: "normal",
        p_link_url: "/portal/help-desk",
        p_actor_id: user.id,
        p_entity_type: "help_desk_ticket",
        p_entity_id: ticket.id,
        p_rich_content: { ticket_number: ticket.ticket_number },
      })

      try {
        await sendHelpDeskMail({
          userIds: [ticket.requester_id],
          subject: `Ticket Resolved: ${ticket.ticket_number}`,
          title: "Help Desk Ticket Resolved",
          message: `${ticket.title} has been resolved. Please confirm and provide your service rating.`,
          ticketNumber: ticket.ticket_number,
        })
      } catch (mailError) {
        console.error("Help desk mail error (resolved):", mailError)
      }
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("Error in PATCH /api/help-desk/tickets/[id]:", error)
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 })
  }
}
