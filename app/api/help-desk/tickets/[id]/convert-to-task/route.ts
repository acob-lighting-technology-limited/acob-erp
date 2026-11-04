import { NextRequest, NextResponse } from "next/server"
import { appendAuditLog, appendHelpDeskEvent, getAuthContext } from "@/lib/help-desk/server"
import { canConvertToTask } from "@/lib/help-desk/permissions"
import { TaskBodySchema } from "@/lib/tasks/schemas"
import { executeCreateTask } from "@/lib/tasks/create-task"
import { sendHelpDeskMail } from "@/lib/help-desk/mailer"
import { createNotification } from "@/lib/notifications/create"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

const log = logger("help-desk-convert-to-task")

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const rl = await rateLimit(`help-desk-convert-task:${getClientId(request)}`, { limit: 15, windowSec: 60 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      { status: 429 }
    )
  }

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

    if (!canConvertToTask(profile, ticket)) {
      return NextResponse.json(
        { error: "Only the receiving department lead or global admin can convert this ticket to a task." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = TaskBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid task data", issues: parsed.error.issues },
        { status: 400 }
      )
    }

    const taskPayload = {
      ...parsed.data,
      source_type: "help_desk" as const,
      source_id: ticket.id,
      department: ticket.service_department ?? parsed.data.department,
    }

    const createResult = await executeCreateTask(supabase, user.id, taskPayload)
    if (createResult.error || !createResult.data) {
      return NextResponse.json(
        { error: createResult.error || "Failed to create task from ticket" },
        { status: createResult.status || 500 }
      )
    }

    const createdTask = createResult.data
    const now = new Date().toISOString()

    const ticketUpdates: Record<string, unknown> = {
      status: "converted",
      task_id: createdTask.id,
      metadata: {
        ...(typeof ticket.metadata === "object" && ticket.metadata !== null ? ticket.metadata : {}),
        converted_task_id: createdTask.id,
        converted_task_number: createdTask.work_item_number,
        converted_at: now,
        converted_by: user.id,
      },
    }

    // Try setting converted_task_id column directly if available
    try {
      const { data: updated, error: updateError } = await supabase
        .from("help_desk_tickets")
        .update({
          ...ticketUpdates,
          converted_task_id: createdTask.id,
        })
        .eq("id", ticket.id)
        .select("*")
        .single()

      if (updateError) {
        // Fallback without converted_task_id if column not yet added
        const { data: fallbackUpdated, error: fallbackError } = await supabase
          .from("help_desk_tickets")
          .update(ticketUpdates)
          .eq("id", ticket.id)
          .select("*")
          .single()

        if (fallbackError) throw fallbackError
        ticketUpdates.updatedTicket = fallbackUpdated
      } else {
        ticketUpdates.updatedTicket = updated
      }
    } catch {
      const { data: fallbackUpdated, error: fallbackError } = await supabase
        .from("help_desk_tickets")
        .update(ticketUpdates)
        .eq("id", ticket.id)
        .select("*")
        .single()

      if (fallbackError) throw fallbackError
      ticketUpdates.updatedTicket = fallbackUpdated
    }

    const updatedTicket = ticketUpdates.updatedTicket

    await appendHelpDeskEvent({
      ticketId: ticket.id,
      actorId: user.id,
      eventType: "ticket_converted_to_task",
      oldStatus: ticket.status,
      newStatus: "converted",
      details: {
        task_id: createdTask.id,
        work_item_number: createdTask.work_item_number,
        weight: taskPayload.weight,
        kpi_id: taskPayload.kpi_id,
      },
    })

    await appendAuditLog({
      actorId: user.id,
      action: "help_desk_ticket_converted",
      entityId: ticket.id,
      department: ticket.service_department,
      route: `/api/help-desk/tickets/${ticket.id}/convert-to-task`,
      critical: true,
      oldValues: { status: ticket.status },
      newValues: {
        status: "converted",
        task_id: createdTask.id,
        work_item_number: createdTask.work_item_number,
      },
    })

    // Notify requester
    await createNotification({
      p_user_id: ticket.requester_id,
      p_type: "help_desk",
      p_category: "help_desk",
      p_title: "Help desk ticket converted to task",
      p_message: `${ticket.ticket_number} - ${ticket.title} is now tracked as task ${createdTask.work_item_number || "TSK"}.`,
      p_priority: ticket.priority === "urgent" ? "urgent" : ticket.priority === "high" ? "high" : "normal",
      p_link_url: `/help-desk/${ticket.id}`,
      p_actor_id: user.id,
      p_entity_type: "help_desk_ticket",
      p_entity_id: ticket.id,
      p_rich_content: {
        converted_task_id: createdTask.id,
        work_item_number: createdTask.work_item_number,
      },
    })

    try {
      await sendHelpDeskMail({
        userIds: [ticket.requester_id],
        subject: `Help Desk Ticket Converted — ${ticket.ticket_number}`,
        title: "Ticket Converted to Task",
        message: `Your ticket ${ticket.ticket_number} ("${ticket.title}") has been converted to an official task (${createdTask.work_item_number || "TSK"}) by the department lead.`,
        ticketNumber: ticket.ticket_number,
        ctaPath: `/help-desk/${ticket.id}`,
      })
    } catch (mailErr) {
      log.error({ err: String(mailErr) }, "Failed to send help desk conversion mail")
    }

    return NextResponse.json(
      {
        data: {
          ticket: updatedTicket,
          task: createdTask,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in POST /api/help-desk/tickets/[id]/convert-to-task")
    return NextResponse.json({ error: "Failed to convert ticket to task" }, { status: 500 })
  }
}
