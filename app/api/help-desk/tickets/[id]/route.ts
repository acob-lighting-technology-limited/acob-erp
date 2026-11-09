import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { HELP_DESK_STATUSES, appendAuditLog, appendHelpDeskEvent, getAuthContext } from "@/lib/help-desk/server"
import {
  canViewTicket,
  canStartWork,
  canPauseWork,
  canResolveTicket,
  canCloseTicket,
  canCancelTicket,
} from "@/lib/help-desk/permissions"

import { getRequestScope } from "@/lib/admin/api-scope"
import { sendHelpDeskMail } from "@/lib/help-desk/mailer"
import { logger } from "@/lib/logger"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { createNotification } from "@/lib/notifications/create"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { archiveHelpDeskTicketToSharePoint } from "@/lib/help-desk/archive"

const log = logger("help-desk-ticket")
export const dynamic = "force-dynamic"
const VALID_HD_TRANSITIONS: Record<string, string[]> = {
  new: ["assigned", "department_queue", "cancelled"],
  department_queue: ["department_assigned", "assigned", "cancelled"],
  department_assigned: ["assigned", "in_progress", "cancelled"],
  assigned: ["in_progress", "cancelled"],
  in_progress: ["resolved", "returned", "cancelled", "paused"],
  paused: ["in_progress", "cancelled"],
  resolved: ["closed", "in_progress"],
  returned: ["in_progress"],
  closed: [],
  cancelled: [],
  pending_lead_review: ["department_queue", "assigned", "cancelled"],
}
const DEPARTMENT_WORKFLOW_STATUSES = new Set(["department_queue", "department_assigned", "pending_lead_review"])
const UpdateHelpDeskTicketSchema = z.object({
  status: z.string().optional(),
  status_note: z.string().optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  rating_comment: z.string().trim().optional().nullable(),
  csat_rating: z.number().int().min(1).max(5).optional().nullable(),
  csat_feedback: z.string().optional().nullable(),
})

export async function GET(_: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const { supabase, user, profile } = await getAuthContext()

    if (!user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: ticket, error } = await supabase.from("help_desk_tickets").select("*").eq("id", params.id).single()

    if (error || !ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    if (!canViewTicket(profile, ticket)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const [commentsRes, eventsRes] = await Promise.all([
      supabase
        .from("help_desk_comments")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true }),
      supabase.from("help_desk_events").select("*").eq("ticket_id", ticket.id).order("created_at", { ascending: true }),
    ])

    return NextResponse.json({
      data: {
        ticket,
        comments: commentsRes.data || [],
        approvals: [],
        events: eventsRes.data || [],
      },
    })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in GET")
    return NextResponse.json({ error: "Failed to fetch ticket" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const rl = await rateLimit(`help-desk-tickets:${getClientId(request)}`, { limit: 20, windowSec: 60 })
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

    const { data: ticket, error: ticketError } = await supabase
      .from("help_desk_tickets")
      .select("*")
      .eq("id", params.id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    const body = await request.json()
    const parsed = UpdateHelpDeskTicketSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }
    const nextStatus = parsed.data.status ? String(parsed.data.status) : null
    const statusNote = parsed.data.status_note ? String(parsed.data.status_note).trim() : null

    const csatRating = parsed.data.csat_rating
    const csatFeedback = parsed.data.csat_feedback ? String(parsed.data.csat_feedback) : null

    const updates: Record<string, unknown> = {}
    const now = new Date().toISOString()
    const metadata = typeof ticket.metadata === "object" && ticket.metadata !== null ? { ...ticket.metadata } : {}

    if (nextStatus) {
      const currentStatus = String(ticket.status)
      const allowed = VALID_HD_TRANSITIONS[currentStatus] || []
      if (!allowed.includes(nextStatus)) {
        return NextResponse.json(
          { error: `Cannot transition from "${currentStatus}" to "${nextStatus}"` },
          { status: 400 }
        )
      }

      if (nextStatus === "in_progress") {
        if (!canStartWork(profile, ticket)) {
          return NextResponse.json({ error: "Forbidden: You cannot start work on this ticket" }, { status: 403 })
        }
        updates.status = "in_progress"
        if (!ticket.started_at) updates.started_at = now
        updates.resumed_at = now
      } else if (nextStatus === "paused") {
        if (!canPauseWork(profile, ticket)) {
          return NextResponse.json({ error: "Forbidden: You cannot pause this ticket" }, { status: 403 })
        }
        updates.status = "paused"
        updates.paused_at = now
      } else if (nextStatus === "resolved") {
        if (!canResolveTicket(profile, ticket)) {
          return NextResponse.json({ error: "Forbidden: You cannot resolve this ticket" }, { status: 403 })
        }
        updates.status = "resolved"
        updates.resolved_at = now
        updates.resolved_by = user.id
        metadata.resolved_by = user.id
        metadata.resolved_at = now
      } else if (nextStatus === "closed") {
        if (!canCloseTicket(profile, ticket)) {
          return NextResponse.json(
            {
              error:
                "Forbidden: Only requester or service lead/admin can close a ticket. Assignees cannot rate or close their own tickets.",
            },
            { status: 403 }
          )
        }
        const effectiveRating = parsed.data.rating ?? (typeof csatRating === "number" ? csatRating : null)
        if (!effectiveRating || effectiveRating < 1 || effectiveRating > 5) {
          return NextResponse.json(
            { error: "A service rating between 1 and 5 is required to close a ticket" },
            { status: 400 }
          )
        }
        const effectiveComment = parsed.data.rating_comment ?? csatFeedback ?? null

        updates.status = "closed"
        updates.closed_at = now
        updates.closed_by = user.id
        updates.rating = effectiveRating
        updates.rating_comment = effectiveComment
        updates.rated_by = user.id
        updates.rated_at = now
        // Backfill legacy csat columns during transition:
        updates.csat_rating = effectiveRating
        updates.csat_feedback = effectiveComment

        metadata.closed_by = user.id
        metadata.closed_at = now
        metadata.rating = effectiveRating
        metadata.rating_comment = effectiveComment
        metadata.rated_by = user.id
        metadata.rated_at = now
      } else if (nextStatus === "cancelled") {
        if (!canCancelTicket(profile, ticket)) {
          return NextResponse.json(
            {
              error:
                "Forbidden: Requesters can only cancel tickets before work starts. Service leads can cancel open tickets.",
            },
            { status: 403 }
          )
        }
        updates.status = "cancelled"
      } else {
        updates.status = nextStatus
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid update provided" }, { status: 400 })
    }

    updates.metadata = metadata

    let updated: any = null
    const { data: primaryUpdated, error: updateError } = await supabase
      .from("help_desk_tickets")
      .update(updates)
      .eq("id", params.id)
      .select("*")
      .single()

    if (updateError) {
      // If forward-compatible columns have not been migrated yet, retry without them
      const safeUpdates = { ...updates }
      delete safeUpdates.rating
      delete safeUpdates.rating_comment
      delete safeUpdates.rated_by
      delete safeUpdates.rated_at
      delete safeUpdates.resolved_by
      delete safeUpdates.closed_by

      const { data: fallbackUpdated, error: fallbackError } = await supabase
        .from("help_desk_tickets")
        .update(safeUpdates)
        .eq("id", params.id)
        .select("*")
        .single()

      if (fallbackError) throw fallbackError
      updated = fallbackUpdated
    } else {
      updated = primaryUpdated
    }

    if (nextStatus && statusNote) {
      const { error: commentError } = await supabase.from("help_desk_comments").insert({
        ticket_id: ticket.id,
        actor_id: user.id,
        body: statusNote,
      })

      if (commentError) throw commentError
    }

    const ticketNumber = updated.ticket_number || ticket.ticket_number

    await appendHelpDeskEvent({
      ticketId: ticket.id,
      actorId: user.id,
      eventType: "ticket_updated",
      oldStatus: ticket.status,
      newStatus: updated.status,
      details: {
        ...updates,
        status_note: statusNote,
      },
    })

    const auditAction = nextStatus && nextStatus !== ticket.status ? "status_change" : "update"

    await appendAuditLog({
      actorId: user.id,
      action: auditAction,
      entityId: ticket.id,
      department: ticket.service_department,
      route: "/api/help-desk/tickets/[id]",
      critical: Boolean(nextStatus && nextStatus !== ticket.status),
      oldValues: { status: ticket.status, csat_rating: ticket.csat_rating },
      newValues: { status: updated.status, csat_rating: updated.csat_rating },
    })

    if (nextStatus === "resolved") {
      await createNotification({
        p_user_id: ticket.requester_id,
        p_type: "help_desk",
        p_category: "help_desk",
        p_title: "Ticket resolved",
        p_message: `${ticketNumber} - ${ticket.title} has been resolved. Please review and close with your service rating.`,
        p_priority: "normal",
        p_link_url: `/help-desk/${ticket.id}`,
        p_actor_id: user.id,
        p_entity_type: "help_desk_ticket",
        p_entity_id: ticket.id,
        p_rich_content: { ticket_number: ticketNumber },
      })

      try {
        await sendHelpDeskMail({
          userIds: [ticket.requester_id],
          subject: `Ticket Resolved: ${ticketNumber}`,
          title: "Help Desk Ticket Resolved",
          message: `${ticket.title} has been resolved. Please confirm and provide your service rating.`,
          ticketNumber: ticketNumber,
          ctaPath: `/help-desk/${ticket.id}`,
        })
      } catch (mailError) {
        log.error({ err: String(mailError) }, "Help desk mail error on resolve")
      }
    } else if (nextStatus === "closed") {
      const closedNotifyUserIds = [
        ticket.assigned_to,
        ticket.requester_id !== user.id ? ticket.requester_id : null,
      ].filter(Boolean) as string[]

      for (const recipientId of closedNotifyUserIds) {
        await createNotification({
          p_user_id: recipientId,
          p_type: "help_desk",
          p_category: "help_desk",
          p_title: "Ticket closed with service rating",
          p_message: `${ticketNumber} - ${ticket.title} has been closed with a service rating of ${updates.rating ?? updates.csat_rating}/5.`,
          p_priority: "normal",
          p_link_url: `/help-desk/${ticket.id}`,
          p_actor_id: user.id,
          p_entity_type: "help_desk_ticket",
          p_entity_id: ticket.id,
          p_rich_content: { ticket_number: ticketNumber, rating: updates.rating ?? updates.csat_rating },
        })
      }

      try {
        await sendHelpDeskMail({
          userIds: closedNotifyUserIds,
          subject: `Ticket Closed: ${ticketNumber}`,
          title: "Help Desk Ticket Closed",
          message: `${ticket.title} has been closed with a service rating of ${updates.rating ?? updates.csat_rating}/5.`,
          ticketNumber: ticketNumber,
          ctaPath: `/help-desk/${ticket.id}`,
        })
      } catch (mailError) {
        log.error({ err: String(mailError) }, "Help desk mail error on close")
      }
    }

    if (["resolved", "closed"].includes(String(updated.status))) {
      const dataClient = getServiceRoleClientOrFallback(supabase)
      void archiveHelpDeskTicketToSharePoint(dataClient, ticket.id).catch((err) => {
        log.error({ ticketId: ticket.id, err: String(err) }, "Background Help Desk archive to SharePoint failed")
      })
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in PATCH")
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 })
  }
}
