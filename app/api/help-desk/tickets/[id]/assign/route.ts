import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { appendAuditLog, appendHelpDeskEvent, getAuthContext } from "@/lib/help-desk/server"
import { canReassignTicket } from "@/lib/help-desk/permissions"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"

import { sendHelpDeskMail } from "@/lib/help-desk/mailer"
import { getUnassignableReason } from "@/lib/workforce/assignment-policy"
import { logger } from "@/lib/logger"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { createNotification } from "@/lib/notifications/create"

const log = logger("help-desk-tickets-assign")
const AssignHelpDeskTicketSchema = z.object({
  assigned_to: z.string().optional().nullable(),
  action: z.string().optional(),
})

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const rl = await rateLimit(`help-desk-tickets-assign:${getClientId(request)}`, { limit: 20, windowSec: 60 })
  if (!rl.allowed)
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      { status: 429 }
    )
  try {
    const { supabase, user, profile } = await getAuthContext()

    if (!user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = AssignHelpDeskTicketSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }

    const assigned_to = parsed.data.assigned_to
    const normalizedAction = String(parsed.data.action || "assign_staff")

    const { data: ticket, error: ticketError } = await supabase
      .from("help_desk_tickets")
      .select("*")
      .eq("id", params.id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    if (!canReassignTicket(profile, ticket)) {
      return NextResponse.json(
        { error: "Forbidden: Only receiving department leads or global admins can assign or reassign this ticket." },
        { status: 403 }
      )
    }

    const now = new Date().toISOString()
    let updates: Record<string, unknown>
    let eventType = "ticket_assigned"
    let newAssignedTo = assigned_to || null

    if (normalizedAction === "send_to_queue") {
      updates = {
        assigned_to: null,
        assigned_by: user.id,
        handling_mode: "queue",
        status: "department_queue",
      }
      eventType = "ticket_sent_to_queue"
      newAssignedTo = null
    } else if (normalizedAction === "assign_department") {
      updates = {
        assigned_to: null,
        assigned_by: user.id,
        handling_mode: "department",
        status: "department_assigned",
      }
      eventType = "ticket_assigned_to_department"
      newAssignedTo = null
    } else if (normalizedAction === "assign_me") {
      updates = {
        assigned_to: user.id,
        assigned_by: user.id,
        handling_mode: "individual",
        status:
          ticket.status === "pending_lead_review" || ticket.status === "department_queue" ? "assigned" : ticket.status,
        assigned_at: ticket.assigned_at ?? now,
      }
      newAssignedTo = user.id
    } else {
      if (!assigned_to) {
        return NextResponse.json({ error: "assigned_to is required" }, { status: 400 })
      }
      const serviceClient = getServiceRoleClientOrFallback(supabase)
      const { data: assignee, error: assigneeError } = await (serviceClient as any)
        .from("staff_directory")
        .select("id, department, employment_status")
        .eq("id", assigned_to)
        .maybeSingle()
      if (assigneeError || !assignee) {
        return NextResponse.json({ error: "Selected assignee not found" }, { status: 400 })
      }
      const unassignableReason = getUnassignableReason(assignee, {
        allowLegacyNullStatus: false,
        requiredDepartment: ticket.service_department,
        allowOnLeave: true,
      })
      if (unassignableReason) {
        return NextResponse.json({ error: unassignableReason }, { status: 400 })
      }
      updates = {
        assigned_to,
        assigned_by: user.id,
        handling_mode: "individual",
        status:
          ticket.status === "new" || ticket.status === "pending_lead_review" || ticket.status === "department_queue"
            ? "assigned"
            : ticket.status,
        assigned_at: ticket.assigned_at ?? now,
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from("help_desk_tickets")
      .update(updates)
      .eq("id", ticket.id)
      .select("*")
      .single()

    if (updateError) throw updateError

    const ticketNumber = updated.ticket_number || ticket.ticket_number

    await appendHelpDeskEvent({
      ticketId: ticket.id,
      actorId: user.id,
      eventType,
      oldStatus: ticket.status,
      newStatus: updated.status,
      details: { from: ticket.assigned_to, to: newAssignedTo, action: normalizedAction },
    })

    await appendAuditLog({
      actorId: user.id,
      action: "help_desk_ticket_assigned",
      entityId: ticket.id,
      department: ticket.service_department,
      route: "/api/help-desk/tickets/[id]/assign",
      critical: true,
      oldValues: { assigned_to: ticket.assigned_to },
      newValues: {
        assigned_to: newAssignedTo,
        handling_mode: updated.handling_mode,
        status: updated.status,
        action: normalizedAction,
      },
    })

    const oldAssigneeId = ticket.assigned_to

    if (oldAssigneeId && oldAssigneeId !== newAssignedTo) {
      await createNotification({
        p_user_id: oldAssigneeId,
        p_type: "help_desk",
        p_category: "help_desk",
        p_title: "Help desk ticket reassigned",
        p_message: `${ticketNumber} - ${ticket.title} has been reassigned to another team member.`,
        p_priority: ticket.priority === "urgent" ? "urgent" : ticket.priority === "high" ? "high" : "normal",
        p_link_url: `/help-desk/${ticket.id}`,
        p_actor_id: user.id,
        p_entity_type: "help_desk_ticket",
        p_entity_id: ticket.id,
        p_rich_content: { service_department: ticket.service_department, priority: ticket.priority },
      })

      try {
        await sendHelpDeskMail({
          userIds: [oldAssigneeId],
          subject: `Help Desk Ticket Reassigned — ${ticketNumber}`,
          title: "Ticket Reassigned",
          message: `${ticket.title} has been reassigned to another team member.`,
          ticketNumber: ticketNumber,
          ctaPath: `/help-desk/${ticket.id}`,
        })
      } catch (err) {
        log.error({ err: String(err) }, "Help desk mail error to old assignee")
      }
    }

    if (newAssignedTo && newAssignedTo !== oldAssigneeId) {
      await createNotification({
        p_user_id: newAssignedTo,
        p_type: "help_desk",
        p_category: "help_desk",
        p_title: "Help desk ticket assigned to you",
        p_message: `${ticketNumber} - ${ticket.title} (${ticket.service_department})`,
        p_priority: ticket.priority === "urgent" ? "urgent" : ticket.priority === "high" ? "high" : "normal",
        p_link_url: `/help-desk/${ticket.id}`,
        p_actor_id: user.id,
        p_entity_type: "help_desk_ticket",
        p_entity_id: ticket.id,
        p_rich_content: { service_department: ticket.service_department, priority: ticket.priority },
      })

      try {
        await sendHelpDeskMail({
          userIds: [newAssignedTo],
          subject: `Help Desk Ticket Assigned — ${ticketNumber}`,
          title: "Ticket Assigned To You",
          message: `${ticket.title} has been assigned to you for execution.`,
          ticketNumber: ticketNumber,
          ctaPath: `/help-desk/${ticket.id}`,
        })
      } catch (mailError) {
        log.error({ err: String(mailError) }, "Help desk mail error (assign):")
      }
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    log.error({ err: String(error) }, "Error in PATCH /api/help-desk/tickets/[id]/assign:")
    return NextResponse.json({ error: "Failed to assign ticket" }, { status: 500 })
  }
}

// POST kept for backwards compat — prefer PATCH
export { PATCH as POST }
