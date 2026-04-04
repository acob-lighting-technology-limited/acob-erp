import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  appendCorrespondenceAuditLog,
  appendCorrespondenceEvent,
  canAccessDepartment,
  getAuthContext,
  getDepartmentCodeByName,
  isAdminRole,
} from "@/lib/correspondence/server"
import { logger } from "@/lib/logger"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { getPaginationRange, paginatedResponse, PaginationSchema } from "@/lib/pagination"
import { checkIdempotency, getIdempotencyKey, storeIdempotencyKey } from "@/lib/idempotency"

const log = logger("correspondence-records")

type CorrespondenceListRecord = {
  department_name?: string | null
  assigned_department_name?: string | null
}

type CorrespondenceLeadCandidate = {
  id: string
  role?: string | null
  lead_departments?: string[] | null
  department?: string | null
  is_department_lead?: boolean | null
}

const CreateCorrespondenceRecordSchema = z.object({
  subject: z.string().trim().min(1, "subject is required"),
  department_name: z.string().trim().optional(),
  letter_type: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  recipient_name: z.string().optional().nullable(),
  sender_name: z.string().optional().nullable(),
  action_required: z.boolean().optional().default(false),
  due_date: z.string().optional().nullable(),
  responsible_officer_id: z.string().optional().nullable(),
  source_mode: z.string().optional().nullable(),
  metadata: z.unknown().optional().nullable(),
})

const CorrespondenceListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional().default(""),
  status: z.string().optional().default(""),
})

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, profile } = await getAuthContext()

    if (!user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const paginationParsed = CorrespondenceListSchema.safeParse(Object.fromEntries(searchParams))
    if (!paginationParsed.success) {
      return NextResponse.json(
        { error: paginationParsed.error.issues[0]?.message ?? "Invalid pagination params" },
        { status: 400 }
      )
    }
    const pagination = PaginationSchema.parse({
      page: paginationParsed.data.page,
      per_page: paginationParsed.data.limit,
    })
    const { from, to } = getPaginationRange(pagination)
    const direction = searchParams.get("direction")
    const status = paginationParsed.data.status || searchParams.get("status")
    const department = searchParams.get("department")
    const dateFrom = searchParams.get("date_from")
    const dateTo = searchParams.get("date_to")
    const search = paginationParsed.data.search.trim()

    let query = supabase
      .from("correspondence_records")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })

    if (direction === "incoming" || direction === "outgoing") {
      query = query.eq("direction", direction)
    }

    if (status) {
      query = query.eq("status", status)
    }

    if (dateFrom) {
      query = query.gte("created_at", dateFrom)
    }

    if (dateTo) {
      query = query.lte("created_at", dateTo)
    }

    if (department) {
      query = query.or(`department_name.eq.${department},assigned_department_name.eq.${department}`)
    }

    if (search) {
      query = query.or(
        `reference_number.ilike.%${search}%,subject.ilike.%${search}%,recipient_name.ilike.%${search}%,sender_name.ilike.%${search}%`
      )
    }

    const { data, error, count } = await query.range(from, to)
    if (error) throw error

    return NextResponse.json({
      data: (data || []) as CorrespondenceListRecord[],
      total: count || 0,
      page: paginationParsed.data.page,
      limit: paginationParsed.data.limit,
      pagination: paginatedResponse((data || []) as CorrespondenceListRecord[], count || 0, pagination).pagination,
    })
  } catch (error) {
    log.error({ err: String(error) }, "Error in GET /api/correspondence/records:")
    return NextResponse.json({ error: "Failed to fetch correspondence records" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, profile } = await getAuthContext()
    const dataClient = getServiceRoleClientOrFallback(supabase)

    if (!user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const idempotencyKey = getIdempotencyKey(request)
    if (idempotencyKey) {
      const { isDuplicate, cachedResponse } = await checkIdempotency(dataClient, idempotencyKey)
      if (isDuplicate) {
        return NextResponse.json(cachedResponse, { status: 200 })
      }
    }

    const body = await request.json()
    const parsed = CreateCorrespondenceRecordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }

    const direction = "outgoing"
    const subject = parsed.data.subject
    const profileDepartment = profile?.department ? String(profile.department).trim() : null
    const departmentName = parsed.data.department_name ? String(parsed.data.department_name).trim() : profileDepartment
    const assignedDepartmentName = departmentName

    if (direction === "outgoing" && !departmentName) {
      return NextResponse.json({ error: "department_name is required for outgoing correspondence" }, { status: 400 })
    }
    const resolvedDepartmentName = departmentName as string

    const departmentCode = await getDepartmentCodeByName(resolvedDepartmentName)
    if (!departmentCode) {
      return NextResponse.json(
        { error: `No active department code configured for ${resolvedDepartmentName}` },
        { status: 400 }
      )
    }

    if (profile.is_department_lead && !isAdminRole(profile.role)) {
      const accessDepartment = departmentName || assignedDepartmentName
      if (accessDepartment && !canAccessDepartment(profile, accessDepartment)) {
        return NextResponse.json({ error: "Forbidden: outside your department scope" }, { status: 403 })
      }
    }

    const initialStatus = "draft"
    const senderName =
      profile?.full_name ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
      user.email ||
      null

    const insertPayload: Record<string, unknown> = {
      direction,
      subject,
      department_name: resolvedDepartmentName,
      department_code: departmentCode,
      letter_type: parsed.data.letter_type || null,
      category: parsed.data.category || null,
      recipient_name: parsed.data.recipient_name ? String(parsed.data.recipient_name).trim() : null,
      sender_name: senderName,
      action_required: parsed.data.action_required,
      due_date: parsed.data.due_date || null,
      responsible_officer_id: parsed.data.responsible_officer_id || null,
      assigned_department_name: assignedDepartmentName,
      source_mode: parsed.data.source_mode || null,
      metadata: parsed.data.metadata || null,
      status: initialStatus,
      originator_id: user.id,
      submitted_at: new Date().toISOString(),
      received_at: null,
    }

    const { data: created, error } = await dataClient
      .from("correspondence_records")
      .insert(insertPayload)
      .select("*")
      .single()

    if (error) throw error

    await appendCorrespondenceEvent({
      correspondenceId: created.id,
      actorId: user.id,
      eventType: "correspondence_created",
      newStatus: created.status,
      details: {
        direction,
        department_name: created.department_name,
        assigned_department_name: created.assigned_department_name,
      },
    })

    await appendCorrespondenceAuditLog({
      actorId: user.id,
      action: "correspondence_record_created",
      recordId: created.id,
      department: created.department_name || created.assigned_department_name || null,
      route: "/api/correspondence/records",
      critical: false,
      newValues: {
        reference_number: created.reference_number,
        direction: created.direction,
        status: created.status,
      },
    })

    try {
      const notifyDepartment = created.assigned_department_name || created.department_name
      if (notifyDepartment) {
        const { data: leadCandidates } = await dataClient
          .from("profiles")
          .select("id, role, lead_departments, department, is_department_lead")
          .eq("is_department_lead", true)

        const targetLead = ((leadCandidates || []) as CorrespondenceLeadCandidate[]).find((p) =>
          canAccessDepartment(p, notifyDepartment)
        )

        if (targetLead?.id) {
          await supabase.rpc("create_notification", {
            p_user_id: targetLead.id,
            p_type: "task_assigned",
            p_category: "operations",
            p_title: "New correspondence logged",
            p_message: `${created.reference_number} - ${created.subject}`,
            p_priority: "normal",
            p_link_url: "/admin/correspondence",
            p_actor_id: user.id,
            p_entity_type: "correspondence_record",
            p_entity_id: created.id,
            p_rich_content: { direction: created.direction, status: created.status },
          })
        }
      }
    } catch (notifyError) {
      log.error({ err: String(notifyError) }, "Correspondence notification error:")
    }

    const responsePayload = { data: created }
    if (idempotencyKey) {
      await storeIdempotencyKey(dataClient, idempotencyKey, responsePayload)
    }

    return NextResponse.json(responsePayload, { status: 201 })
  } catch (error) {
    log.error({ err: String(error) }, "Error in POST /api/correspondence/records:")
    const details = error as { message?: string; details?: string; hint?: string; code?: string }
    return NextResponse.json(
      {
        error: details?.message || "Failed to create correspondence record",
        details: details?.details || null,
        hint: details?.hint || null,
        code: details?.code || null,
      },
      { status: 500 }
    )
  }
}
