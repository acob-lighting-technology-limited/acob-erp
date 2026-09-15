import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { logger } from "@/lib/logger"
import {
  isActionTrackerAdmin,
  isUserInActionDepartment,
  type ActionTrackerScopeProfile,
} from "@/lib/reports/action-tracker-permissions"

const log = logger("api-reports-general-meeting-challenges")

const UpdateChallengeSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "mitigating", "resolved", "closed"]).optional(),
  resolution_note: z.string().optional().nullable(),
  owner_id: z.string().uuid().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekParam = searchParams.get("week")
    const yearParam = searchParams.get("year")
    const deptParam = searchParams.get("dept")
    const statusParam = searchParams.get("status")

    const dataClient = getServiceRoleClientOrFallback(supabase)
    let query = dataClient
      .from("meeting_challenges")
      .select(
        `
        id,
        title,
        description,
        department,
        week_number,
        year,
        status,
        resolution_note,
        report_id,
        owner_id,
        created_by,
        position,
        created_at,
        updated_at,
        created_by_profile:created_by (id, first_name, last_name),
        owner_profile:owner_id (id, first_name, last_name)
      `
      )
      .order("year", { ascending: false })
      .order("week_number", { ascending: false })
      .order("department", { ascending: true })
      .order("position", { ascending: true })

    if (weekParam && weekParam !== "all") {
      const parsedWeek = parseInt(weekParam, 10)
      if (!Number.isNaN(parsedWeek)) {
        query = query.eq("week_number", parsedWeek)
      }
    }

    if (yearParam && yearParam !== "all") {
      const parsedYear = parseInt(yearParam, 10)
      if (!Number.isNaN(parsedYear)) {
        query = query.eq("year", parsedYear)
      }
    }

    if (deptParam && deptParam !== "all") {
      query = query.eq("department", deptParam)
    }

    if (statusParam && statusParam !== "all") {
      query = query.eq("status", statusParam)
    }

    const { data, error } = await query

    if (error) {
      log.error({ err: error.message }, "Failed to fetch meeting challenges")
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error"
    log.error({ err: msg }, "Failed in GET /api/reports/general-meeting/challenges")
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const parsed = UpdateChallengeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation failed" }, { status: 400 })
    }

    const { id, status, resolution_note, owner_id } = parsed.data

    const dataClient = getServiceRoleClientOrFallback(supabase)
    const { data: challenge, error: fetchError } = await dataClient
      .from("meeting_challenges")
      .select("id, department, status, resolution_note")
      .eq("id", id)
      .single()

    if (fetchError || !challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 })
    }

    // Permission check
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, department, is_department_lead, lead_departments")
      .eq("id", user.id)
      .single<ActionTrackerScopeProfile>()

    const referer = request.headers.get("referer") || ""
    let isAdminContext = false
    try {
      isAdminContext = new URL(referer).pathname.startsWith("/admin/")
    } catch {
      isAdminContext = false
    }

    const isAdmin = isActionTrackerAdmin(profile)
    const isDeptLeadOrMember = isUserInActionDepartment(profile, challenge.department)

    // Allowed if:
    // 1) Global admin in admin context
    // 2) Department lead for this department
    if (!(isAdmin && isAdminContext) && !isDeptLeadOrMember) {
      return NextResponse.json(
        { error: `Forbidden: Only administrators or leads of ${challenge.department} can update this challenge.` },
        { status: 403 }
      )
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (status !== undefined) updatePayload.status = status
    if (resolution_note !== undefined) updatePayload.resolution_note = resolution_note
    if (owner_id !== undefined) updatePayload.owner_id = owner_id

    const { data: updated, error: updateError } = await dataClient
      .from("meeting_challenges")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single()

    if (updateError) {
      log.error({ err: updateError.message, id }, "Failed to update challenge")
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ data: updated })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error"
    log.error({ err: msg }, "Failed in PATCH /api/reports/general-meeting/challenges")
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
