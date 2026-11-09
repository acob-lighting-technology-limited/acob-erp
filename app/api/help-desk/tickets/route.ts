import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  HELP_DESK_PRIORITIES,
  getAuthContext,
  HelpDeskProfile,
  HelpDeskTicketRow,
  generateFallbackHelpDeskTicketNumber,
  getSlaTarget,
  isAdminRole,
  appendHelpDeskEvent,
  appendAuditLog,
  canLeadDepartment,
  resolveLeadForDepartment,
} from "@/lib/help-desk/server"
import { getRequestScope, getScopedDepartments } from "@/lib/admin/api-scope"
import { sendHelpDeskMail } from "@/lib/help-desk/mailer"
import { loadAwayToday } from "@/lib/admin/away-today"
import { isAssignableProfile, getUnassignableReason } from "@/lib/workforce/assignment-policy"
import { toLocalISODate, formatWATDate } from "@/lib/utils/date"
import { formatFullName } from "@/lib/utils"
import { logger } from "@/lib/logger"
import { getPaginationRange, paginatedResponse, PaginationSchema } from "@/lib/pagination"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { checkIdempotency, getIdempotencyKey, storeIdempotencyKey } from "@/lib/idempotency"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { getDepartmentAliases } from "@/shared/departments"
import { createNotification } from "@/lib/notifications/create"

const log = logger("help-desk-tickets")
export const dynamic = "force-dynamic"

type ErrorWithCode = {
  code?: string
  message?: string
  details?: string
}

type InsertTicketResult = {
  data: HelpDeskTicketRow | null
  error: ErrorWithCode | null
}

type CommentCountRow = {
  ticket_id: string | null
}

const CreateTicketSchema = z.object({
  title: z.string().trim().min(1, "title and service_department are required"),
  description: z.string().optional(),
  service_department: z.string().trim().min(1, "title and service_department are required"),
  priority: z.enum(HELP_DESK_PRIORITIES).optional().default("medium"),
  assigned_to: z.string().trim().optional().nullable(),
})

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  if (error && typeof error === "object") {
    const maybe = error as Record<string, unknown>
    const parts = [
      typeof maybe.message === "string" ? maybe.message : "",
      typeof maybe.details === "string" ? maybe.details : "",
      typeof maybe.hint === "string" ? maybe.hint : "",
      typeof maybe.code === "string" ? `code=${maybe.code}` : "",
    ].filter(Boolean)
    if (parts.length > 0) return parts.join(" | ")
    try {
      return JSON.stringify(maybe)
    } catch {
      return "Unserializable error object"
    }
  }
  return "Unknown error"
}

function isTicketNumberConflict(error: ErrorWithCode | null | undefined) {
  if (!error) return false
  const code = String(error.code || "")
  const text = `${String(error.message || "")} ${String(error.details || "")}`.toLowerCase()
  return code === "23505" && text.includes("help_desk_tickets_ticket_number_key")
}

function getManagedDepartments(profile: HelpDeskProfile): string[] {
  return Array.isArray(profile.managed_departments) ? profile.managed_departments : []
}

function quotePostgrestValue(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`
}

function helpDeskDepartmentFilter(department: string): string {
  const values = getDepartmentAliases(department).map(quotePostgrestValue).join(",")
  return `service_department.in.(${values}),requester_department.in.(${values})`
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, profile } = await getAuthContext()

    if (!user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const paginationParsed = PaginationSchema.safeParse(Object.fromEntries(searchParams))
    if (!paginationParsed.success) {
      return NextResponse.json(
        { error: paginationParsed.error.issues[0]?.message ?? "Invalid pagination params" },
        { status: 400 }
      )
    }
    const pagination = paginationParsed.data
    const { from, to } = getPaginationRange(pagination)
    const wantsPage = searchParams.has("page") || searchParams.has("per_page")
    const scope = searchParams.get("scope") || "mine"
    const status = searchParams.get("status")
    const requestedDepartment = searchParams.get("department")

    let query = supabase
      .from("help_desk_tickets")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })

    const managedDepartments = getManagedDepartments(profile as HelpDeskProfile)
    const requestScope = await getRequestScope()
    const scopedDepts = requestScope ? getScopedDepartments(requestScope) : []

    if (scope === "mine") {
      query = query.or(`requester_id.eq.${user.id},assigned_to.eq.${user.id},created_by.eq.${user.id}`)
    } else if (scope === "service_department") {
      if (!profile.department) {
        return NextResponse.json(paginatedResponse([], 0, pagination))
      }
      query = query.eq("service_department", profile.department).in("handling_mode", ["queue", "department"])
    } else if (scope === "department") {
      // Global admin (scopeMode: "global") → scopedDepts is null → no filter.
      // Lead-mode admin or department lead → scopedDepts is an array → filter by managed depts.
      if (scopedDepts !== null && !profile.is_department_lead) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      if (requestedDepartment) {
        if (!canLeadDepartment(profile, requestedDepartment)) {
          return NextResponse.json({ error: "Forbidden: outside your department scope" }, { status: 403 })
        }
        query = query.or(helpDeskDepartmentFilter(requestedDepartment))
      } else if (scopedDepts === null) {
        // Global admin — no department filter needed
      } else if (!scopedDepts.length) {
        return NextResponse.json(paginatedResponse([], 0, pagination))
      } else {
        const deptList = scopedDepts.join(",")
        query = query.or(`service_department.in.(${deptList}),requester_department.in.(${deptList})`)
      }
    }

    if (status) {
      query = query.eq("status", status)
    }

    const { data, error, count } = wantsPage ? await query.range(from, to) : await query
    if (error) throw error

    const rows = (data as HelpDeskTicketRow[] | null) || []
    const ticketIds = rows.map((row) => row.id).filter(Boolean)
    const { data: commentRows } =
      ticketIds.length > 0
        ? await supabase.from("help_desk_comments").select("ticket_id").in("ticket_id", ticketIds)
        : { data: [] }
    const commentCountMap = new Map<string, number>()
    for (const row of (commentRows as CommentCountRow[] | null) || []) {
      const ticketId = String(row.ticket_id || "")
      if (!ticketId) continue
      commentCountMap.set(ticketId, (commentCountMap.get(ticketId) || 0) + 1)
    }

    const rowsWithCounts = rows.map((row) => ({
      ...row,
      comment_count: commentCountMap.get(row.id) || 0,
    }))

    return NextResponse.json(
      paginatedResponse(rowsWithCounts, count || 0, {
        ...pagination,
        per_page: wantsPage ? pagination.per_page : count || rowsWithCounts.length || pagination.per_page,
      })
    )
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in GET")
    return NextResponse.json({ error: `Failed to fetch tickets: ${describeError(error)}` }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rl = await rateLimit(`help-desk-tickets:${getClientId(request)}`, { limit: 20, windowSec: 60 })
  if (!rl.allowed)
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      { status: 429 }
    )
  try {
    const { supabase, user, profile } = await getAuthContext()
    const idempotencyClient = getServiceRoleClientOrFallback(supabase)

    if (!user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const idempotencyKey = getIdempotencyKey(request)
    if (idempotencyKey) {
      const { isDuplicate, cachedResponse } = await checkIdempotency(idempotencyClient, idempotencyKey)
      if (isDuplicate) {
        return NextResponse.json(cachedResponse, { status: 200 })
      }
    }

    const body = await request.json()
    const parsed = CreateTicketSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }

    const title = parsed.data.title
    const description = (parsed.data.description || "").trim()
    const serviceDepartment = parsed.data.service_department
    const priority = parsed.data.priority

    const postScope = await getRequestScope()
    const isGlobalAdminPost = isAdminRole(profile.role) && postScope?.scopeMode !== "lead"
    if (!isGlobalAdminPost && profile.department && profile.department === serviceDepartment) {
      return NextResponse.json(
        { error: "You cannot submit help desk requests to your own department" },
        { status: 400 }
      )
    }

    const submittedAt = new Date()
    const slaTarget = getSlaTarget(priority, submittedAt)
    const supportMode = "open_queue" as const
    const commonCategoryValue = "Support"

    const rawAssignedTo = parsed.data.assigned_to?.trim() || null
    let assignedToId: string | null = null
    let assigneeName: string = ""
    let isAssigneeOnLeave = false
    let onLeaveUntilFormatted: string = ""

    type StaffDirectoryRow = {
      id: string
      first_name: string | null
      last_name: string | null
      full_name: string | null
      department: string | null
      employment_status: string | null
    }

    const serviceClient = getServiceRoleClientOrFallback(supabase)

    if (rawAssignedTo) {
      const { data: rawAssignee, error: assigneeErr } = await (serviceClient as any)
        .from("staff_directory")
        .select("id, first_name, last_name, full_name, department, employment_status")
        .eq("id", rawAssignedTo)
        .single()
      const assigneeRow = rawAssignee as StaffDirectoryRow | null

      if (assigneeErr || !assigneeRow) {
        return NextResponse.json({ error: "Selected assignee not found" }, { status: 400 })
      }

      const unassignableReason = getUnassignableReason(
        { employment_status: assigneeRow.employment_status, department: assigneeRow.department },
        { requiredDepartment: serviceDepartment, allowOnLeave: true }
      )
      if (unassignableReason) {
        return NextResponse.json({ error: unassignableReason }, { status: 400 })
      }

      assignedToId = assigneeRow.id
      assigneeName =
        formatFullName(assigneeRow.first_name, assigneeRow.last_name) || assigneeRow.full_name || "Assignee"

      const todayIso = toLocalISODate()
      const awayRecords = await loadAwayToday(serviceClient, todayIso, [assignedToId as string])
      if (awayRecords.length > 0) {
        isAssigneeOnLeave = true
        if (awayRecords[0]?.until) {
          onLeaveUntilFormatted = formatWATDate(awayRecords[0].until, { day: "numeric", month: "short" })
        }
      }
    }

    const initialStatus = assignedToId ? "assigned" : "department_queue"
    const initialHandlingMode = assignedToId ? "individual" : "queue"

    const insertPayload = {
      title,
      description: description || null,
      service_department: serviceDepartment,
      category: commonCategoryValue,
      priority,
      status: initialStatus,
      requester_id: user.id,
      created_by: user.id,
      assigned_to: assignedToId,
      assigned_by: assignedToId ? user.id : null,
      assigned_at: assignedToId ? submittedAt.toISOString() : null,
      requester_department: profile.department || null,
      support_mode: supportMode,
      handling_mode: initialHandlingMode,
      submitted_at: submittedAt.toISOString(),
      sla_target_at: slaTarget.toISOString(),
      paused_at: null,
    }

    const insertTicketWithCollisionRetry = async (payload: Record<string, unknown>): Promise<InsertTicketResult> => {
      let attemptPayload = payload
      let lastError: ErrorWithCode | null = null

      for (let attempt = 0; attempt < 4; attempt += 1) {
        const { data, error } = await supabase.from("help_desk_tickets").insert(attemptPayload).select("*").single()

        if (!error) return { data: data as HelpDeskTicketRow, error: null }
        lastError = error

        if (!isTicketNumberConflict(error)) break
        attemptPayload = { ...payload, ticket_number: generateFallbackHelpDeskTicketNumber() }
      }

      return { data: null, error: lastError }
    }

    const { data: created, error: createError } = await insertTicketWithCollisionRetry(insertPayload)

    if (createError) throw createError
    if (!created) {
      throw new Error("Ticket creation returned no record")
    }

    const { data: leadCandidates } = await supabase
      .from("profiles")
      .select("id, role, full_name, is_department_lead, lead_departments, department")
      .eq("is_department_lead", true)

    const serviceLead = resolveLeadForDepartment(leadCandidates || [], serviceDepartment)

    await appendHelpDeskEvent({
      ticketId: created.id,
      actorId: user.id,
      eventType: "ticket_created",
      newStatus: created.status,
      details: {
        priority,
        serviceDepartment,
        support_mode: supportMode,
        requester_department: profile.department || null,
      },
    })

    await appendAuditLog({
      actorId: user.id,
      action: "help_desk_ticket_created",
      entityId: created.id,
      department: serviceDepartment,
      route: "/api/help-desk/tickets",
      critical: false,
      newValues: {
        status: created.status,
        request_type: created.request_type,
        priority: created.priority,
        service_department: created.service_department,
        requester_department: created.requester_department,
        support_mode: created.support_mode,
      },
    })

    if (assignedToId) {
      // Notify assigned staff member
      await createNotification({
        p_user_id: assignedToId,
        p_type: "help_desk",
        p_category: "help_desk",
        p_title: "New help desk ticket assigned to you",
        p_message: `${created.ticket_number} - ${created.title} (${created.service_department})`,
        p_priority: priority === "urgent" ? "urgent" : priority === "high" ? "high" : "normal",
        p_link_url: `/help-desk/${created.id}`,
        p_actor_id: user.id,
        p_entity_type: "help_desk_ticket",
        p_entity_id: created.id,
        p_rich_content: {
          priority,
          service_department: serviceDepartment,
        },
      })

      // Notify department lead for visibility so they can reassign if needed
      if (serviceLead?.id) {
        const leaveNote = isAssigneeOnLeave
          ? ` (Note: Assignee is currently on leave${onLeaveUntilFormatted ? ` until ${onLeaveUntilFormatted}` : ""})`
          : ""
        await createNotification({
          p_user_id: serviceLead.id,
          p_type: "help_desk",
          p_category: "help_desk",
          p_title: "New ticket assigned in your department",
          p_message: `${created.ticket_number} - ${created.title} (Assigned to ${assigneeName}${leaveNote})`,
          p_priority: priority === "urgent" ? "urgent" : priority === "high" ? "high" : "normal",
          p_link_url: `/admin/help-desk/${created.id}`,
          p_actor_id: user.id,
          p_entity_type: "help_desk_ticket",
          p_entity_id: created.id,
          p_rich_content: {
            priority,
            service_department: serviceDepartment,
            assigned_to: assignedToId,
            is_on_leave: isAssigneeOnLeave,
          },
        })
      }

      try {
        await sendHelpDeskMail({
          userIds: [user.id, assignedToId, serviceLead?.id].filter(Boolean) as string[],
          subject: `Help Desk Ticket Created — ${created.ticket_number}`,
          title: "New Help Desk Ticket Submitted",
          message: `${created.title} (${created.service_department}) has been submitted and assigned to ${assigneeName}.`,
          ticketNumber: created.ticket_number,
          ctaPath: `/help-desk/${created.id}`,
        })
      } catch (mailError) {
        log.error({ err: String(mailError) }, "Help desk mail error on create")
      }
    } else {
      if (serviceLead?.id) {
        await createNotification({
          p_user_id: serviceLead.id,
          p_type: "help_desk",
          p_category: "help_desk",
          p_title: "New help desk ticket in your queue",
          p_message: `${created.ticket_number} - ${created.title}`,
          p_priority: priority === "urgent" ? "urgent" : priority === "high" ? "high" : "normal",
          p_link_url: `/admin/help-desk/${created.id}`,
          p_actor_id: user.id,
          p_entity_type: "help_desk_ticket",
          p_entity_id: created.id,
          p_rich_content: {
            priority,
            service_department: serviceDepartment,
            requester_department: profile.department || null,
            support_mode: supportMode,
          },
        })
      }

      try {
        await sendHelpDeskMail({
          userIds: [user.id, serviceLead?.id].filter(Boolean) as string[],
          subject: `Help Desk Ticket Created — ${created.ticket_number}`,
          title: "New Help Desk Ticket Submitted",
          message: `${created.title} (${created.service_department}) has been submitted with ${created.priority} priority.`,
          ticketNumber: created.ticket_number,
          ctaPath: `/help-desk/${created.id}`,
        })
      } catch (mailError) {
        log.error({ err: String(mailError) }, "Help desk mail error on create")
      }
    }

    const responsePayload = { data: created }
    if (idempotencyKey) {
      await storeIdempotencyKey(idempotencyClient, idempotencyKey, responsePayload)
    }

    return NextResponse.json(responsePayload, { status: 201 })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in POST")
    return NextResponse.json({ error: `Failed to create ticket: ${describeError(error)}` }, { status: 500 })
  }
}
