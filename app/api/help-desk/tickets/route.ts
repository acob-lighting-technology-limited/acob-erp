import { NextRequest, NextResponse } from "next/server"
import {
  HELP_DESK_PRIORITIES,
  canLeadDepartment,
  getAuthContext,
  getSlaTarget,
  isAdminRole,
  appendHelpDeskEvent,
  appendAuditLog,
  resolveLeadForDepartment,
} from "@/lib/help-desk/server"
import { sendHelpDeskMail } from "@/lib/help-desk/mailer"

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

function generateFallbackHelpDeskTicketNumber() {
  const epochMillis = Date.now().toString()
  const randomSuffix = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")
  return `HD-${epochMillis}${randomSuffix}`
}

function isTicketNumberConflict(error: any) {
  if (!error) return false
  const code = String(error.code || "")
  const text = `${String(error.message || "")} ${String(error.details || "")}`.toLowerCase()
  return code === "23505" && text.includes("help_desk_tickets_ticket_number_key")
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, profile } = await getAuthContext()

    if (!user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const scope = searchParams.get("scope") || "mine"
    const status = searchParams.get("status")

    let query = supabase.from("help_desk_tickets").select("*").order("created_at", { ascending: false })

    const managedDepartments = Array.isArray((profile as any)?.managed_departments)
      ? ((profile as any).managed_departments as string[])
      : []

    if (scope === "mine") {
      query = query.or(`requester_id.eq.${user.id},assigned_to.eq.${user.id},created_by.eq.${user.id}`)
    } else if (scope === "department") {
      if (!isAdminRole(profile.role) && !profile.is_department_lead) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      if (isAdminRole(profile.role)) {
        // Admin can see all departments in this scope.
      } else if (!managedDepartments.length) {
        return NextResponse.json({ data: [] })
      }
    }

    if (status) {
      query = query.eq("status", status)
    }

    const { data, error } = await query
    if (error) throw error

    let rows = data || []
    if (scope === "department" && !isAdminRole(profile.role)) {
      const managedDepartments = Array.isArray((profile as any)?.managed_departments)
        ? ((profile as any).managed_departments as string[])
        : []
      rows = rows.filter(
        (row: any) =>
          managedDepartments.includes(row.service_department) || managedDepartments.includes(row.requester_department)
      )
    }

    return NextResponse.json({ data: rows })
  } catch (error) {
    console.error("Error in GET /api/help-desk/tickets:", error)
    return NextResponse.json({ error: `Failed to fetch tickets: ${describeError(error)}` }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, profile } = await getAuthContext()

    if (!user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const title = String(body?.title || "").trim()
    const description = String(body?.description || "").trim()
    const serviceDepartment = String(body?.service_department || "").trim()
    const requestType = body?.request_type === "procurement" ? "procurement" : "support"
    const priority = body?.priority ? String(body.priority).toLowerCase() : "medium"

    if (!title || !serviceDepartment) {
      return NextResponse.json({ error: "title and service_department are required" }, { status: 400 })
    }

    if (!HELP_DESK_PRIORITIES.includes(priority as any)) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 })
    }

    const managedDepartments = Array.isArray((profile as any)?.managed_departments)
      ? ((profile as any).managed_departments as string[])
      : []
    if (
      profile.is_department_lead &&
      managedDepartments.length > 0 &&
      !managedDepartments.includes(serviceDepartment)
    ) {
      return NextResponse.json({ error: "Forbidden: outside your department scope" }, { status: 403 })
    }

    const submittedAt = new Date()
    const slaTarget = getSlaTarget(priority as any, submittedAt)
    const approvalRequired = requestType === "procurement"
    const supportMode: "open_queue" | "lead_review_required" | null = requestType === "support" ? "open_queue" : null

    const initialStatus = approvalRequired ? "pending_approval" : "department_queue"
    const initialHandlingMode = approvalRequired ? "individual" : "queue"

    const commonCategoryValue = requestType === "procurement" ? "Procurement" : "Support"

    const modernInsertPayload = {
      title,
      description: description || null,
      service_department: serviceDepartment,
      request_type: requestType,
      category: commonCategoryValue,
      category_id: null,
      priority,
      status: initialStatus,
      requester_id: user.id,
      created_by: user.id,
      requester_department: profile.department || null,
      support_mode: supportMode,
      handling_mode: initialHandlingMode,
      approval_required: approvalRequired,
      submitted_at: submittedAt.toISOString(),
      sla_target_at: slaTarget.toISOString(),
      paused_at: approvalRequired ? submittedAt.toISOString() : null,
      current_approval_stage: approvalRequired ? "requester_department_lead" : null,
    }

    const legacyInsertPayload = {
      title,
      description: description || null,
      service_department: serviceDepartment,
      request_type: requestType,
      category: commonCategoryValue,
      priority,
      status: approvalRequired ? "pending_approval" : "new",
      requester_id: user.id,
      created_by: user.id,
      approval_required: approvalRequired,
      submitted_at: submittedAt.toISOString(),
      sla_target_at: slaTarget.toISOString(),
      paused_at: approvalRequired ? submittedAt.toISOString() : null,
    }

    const insertTicketWithCollisionRetry = async (payload: Record<string, any>) => {
      let attemptPayload = payload
      let lastError: any = null

      for (let attempt = 0; attempt < 4; attempt += 1) {
        const { data, error } = await supabase.from("help_desk_tickets").insert(attemptPayload).select("*").single()

        if (!error) return { data, error: null as any }
        lastError = error

        if (!isTicketNumberConflict(error)) break
        attemptPayload = { ...payload, ticket_number: generateFallbackHelpDeskTicketNumber() }
      }

      return { data: null as any, error: lastError }
    }

    let { data: created, error: createError } = await insertTicketWithCollisionRetry(modernInsertPayload)

    const schemaDriftError =
      !!createError &&
      typeof createError.message === "string" &&
      (createError.message.includes("column") ||
        createError.message.includes("violates check constraint") ||
        createError.message.includes("invalid input value"))

    if (schemaDriftError) {
      ;({ data: created, error: createError } = await insertTicketWithCollisionRetry(legacyInsertPayload))
    }

    if (createError) throw createError

    const { data: leadCandidates } = await supabase
      .from("profiles")
      .select("id, role, full_name, is_department_lead, lead_departments, department")
      .eq("is_department_lead", true)

    const requesterLead = resolveLeadForDepartment(leadCandidates || [], profile.department)
    const serviceLead = resolveLeadForDepartment(leadCandidates || [], serviceDepartment)

    if (approvalRequired) {
      const modernApprovals = [
        { ticket_id: created.id, approval_stage: "requester_department_lead", status: "pending" },
        { ticket_id: created.id, approval_stage: "service_department_lead", status: "pending" },
        { ticket_id: created.id, approval_stage: "head_corporate_services", status: "pending" },
        { ticket_id: created.id, approval_stage: "managing_director", status: "pending" },
      ]
      const legacyApprovals = [
        { ticket_id: created.id, approval_stage: "department_lead", status: "pending" },
        { ticket_id: created.id, approval_stage: "head_corporate_services", status: "pending" },
        { ticket_id: created.id, approval_stage: "managing_director", status: "pending" },
      ]
      const { error: approvalsError } = await supabase.from("help_desk_approvals").insert(modernApprovals)
      if (approvalsError) {
        await supabase.from("help_desk_approvals").insert(legacyApprovals)
      }
    }

    await appendHelpDeskEvent({
      ticketId: created.id,
      actorId: user.id,
      eventType: "ticket_created",
      newStatus: created.status,
      details: {
        priority,
        requestType,
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

    const firstApprover = approvalRequired ? requesterLead : serviceLead

    if (firstApprover?.id) {
      await supabase.rpc("create_notification", {
        p_user_id: firstApprover.id,
        p_type: approvalRequired ? "approval_request" : "task_assigned",
        p_category: approvalRequired ? "approvals" : "tasks",
        p_title: approvalRequired ? "Procurement ticket needs approval" : "New help desk ticket in your queue",
        p_message: `${created.ticket_number} - ${created.title}`,
        p_priority: priority === "urgent" ? "urgent" : priority === "high" ? "high" : "normal",
        p_link_url: "/admin/help-desk",
        p_actor_id: user.id,
        p_entity_type: "help_desk_ticket",
        p_entity_id: created.id,
        p_rich_content: {
          request_type: requestType,
          priority,
          service_department: serviceDepartment,
          requester_department: profile.department || null,
          support_mode: supportMode,
        },
      })
    }

    try {
      await sendHelpDeskMail({
        userIds: [user.id, firstApprover?.id].filter(Boolean) as string[],
        subject: `Help Desk Ticket Created: ${created.ticket_number}`,
        title: "New Help Desk Ticket Submitted",
        message: `${created.title} (${created.service_department}) has been submitted with ${created.priority} priority.`,
        ticketNumber: created.ticket_number,
        ctaPath: approvalRequired ? "/admin/help-desk" : "/dashboard/help-desk",
      })
    } catch (mailError) {
      console.error("Help desk mail error (create):", mailError)
    }

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error) {
    console.error("Error in POST /api/help-desk/tickets:", error)
    return NextResponse.json({ error: `Failed to create ticket: ${describeError(error)}` }, { status: 500 })
  }
}
