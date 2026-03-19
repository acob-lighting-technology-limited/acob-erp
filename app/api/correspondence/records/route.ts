import { NextRequest, NextResponse } from "next/server"
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

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, profile } = await getAuthContext()

    if (!user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const direction = searchParams.get("direction")
    const status = searchParams.get("status")
    const department = searchParams.get("department")
    const dateFrom = searchParams.get("date_from")
    const dateTo = searchParams.get("date_to")

    let query = supabase.from("correspondence_records").select("*").order("created_at", { ascending: false })

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

    const { data, error } = await query
    if (error) throw error

    const filtered = ((data || []) as CorrespondenceListRecord[]).filter((record) => {
      if (!department) return true
      return record.department_name === department || record.assigned_department_name === department
    })

    return NextResponse.json({ data: filtered })
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

    const body = await request.json()
    const direction = "outgoing"
    const subject = String(body?.subject || "").trim()
    const profileDepartment = profile?.department ? String(profile.department).trim() : null
    const departmentName = body?.department_name ? String(body.department_name).trim() : profileDepartment
    const assignedDepartmentName = departmentName

    if (!subject) {
      return NextResponse.json({ error: "subject is required" }, { status: 400 })
    }

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
      (body?.sender_name ? String(body.sender_name).trim() : "") ||
      profile?.full_name ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
      user.email ||
      null

    const insertPayload: Record<string, unknown> = {
      direction,
      subject,
      department_name: resolvedDepartmentName,
      department_code: departmentCode,
      letter_type: body?.letter_type || null,
      category: body?.category || null,
      recipient_name: body?.recipient_name ? String(body.recipient_name).trim() : null,
      sender_name: senderName,
      action_required: Boolean(body?.action_required),
      due_date: body?.due_date || null,
      responsible_officer_id: body?.responsible_officer_id || null,
      assigned_department_name: assignedDepartmentName,
      source_mode: body?.source_mode || null,
      metadata: body?.metadata || null,
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

    return NextResponse.json({ data: created }, { status: 201 })
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
