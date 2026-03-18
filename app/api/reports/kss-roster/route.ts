import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { resolveAdminScope, getDepartmentScope, normalizeDepartmentName } from "@/lib/admin/rbac"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { resolveEffectiveMeetingDateIso } from "@/lib/reports/meeting-date"
import { logger } from "@/lib/logger"

const log = logger("api-reports-kss-roster")

async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Ignore write attempts from server component contexts.
        }
      },
    },
  })
}

function normalizeDepartment(value: string): string {
  return normalizeDepartmentName(String(value || "").trim())
}

function hasGlobalReportsWriteAccess(scope: NonNullable<Awaited<ReturnType<typeof resolveAdminScope>>>): boolean {
  return getDepartmentScope(scope, "general") === null
}

async function assertWeekIsMutable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  meetingWeek: number,
  meetingYear: number
) {
  const { data, error } = await supabase.rpc("weekly_report_can_mutate", {
    p_week: meetingWeek,
    p_year: meetingYear,
  })

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error(`Week ${meetingWeek}, ${meetingYear} is locked and can no longer be changed`)
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const scope = await resolveAdminScope(supabase as any, user.id)
    if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const week = Number(searchParams.get("week") || "")
    const year = Number(searchParams.get("year") || "")

    let query = supabase
      .from("kss_weekly_roster")
      .select(
        "id, meeting_week, meeting_year, department, presenter_id, notes, is_active, created_by, created_at, updated_at"
      )
      .order("meeting_year", { ascending: false })
      .order("meeting_week", { ascending: false })

    if (Number.isFinite(week) && week > 0) query = query.eq("meeting_week", week)
    if (Number.isFinite(year) && year > 0) query = query.eq("meeting_year", year)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = data || []
    const withLockState = await Promise.all(
      rows.map(async (row) => {
        const meetingDate = await resolveEffectiveMeetingDateIso(supabase, row.meeting_week, row.meeting_year)
        const { data: canMutate } = await supabase.rpc("weekly_report_can_mutate", {
          p_week: row.meeting_week,
          p_year: row.meeting_year,
        })

        return {
          ...row,
          meeting_date: meetingDate,
          is_locked: !Boolean(canMutate),
        }
      })
    )

    return NextResponse.json({ data: withLockState })
  } catch (error) {
    log.error({ err: String(error) }, "GET /api/reports/kss-roster failed")
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const scope = await resolveAdminScope(supabase as any, user.id)
    if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (!hasGlobalReportsWriteAccess(scope)) {
      return NextResponse.json({ error: "Only reports admins can create KSS roster entries" }, { status: 403 })
    }

    const body = await request.json()
    const meetingWeek = Number(body?.meetingWeek)
    const meetingYear = Number(body?.meetingYear)
    const department = normalizeDepartment(String(body?.department || ""))
    const presenterId = body?.presenterId ? String(body.presenterId) : null
    const notes = body?.notes ? String(body.notes) : null

    if (!Number.isFinite(meetingWeek) || meetingWeek < 1 || meetingWeek > 53) {
      return NextResponse.json({ error: "meetingWeek must be between 1 and 53" }, { status: 400 })
    }
    if (!Number.isFinite(meetingYear) || meetingYear < 2000 || meetingYear > 2100) {
      return NextResponse.json({ error: "meetingYear must be between 2000 and 2100" }, { status: 400 })
    }
    if (!department) {
      return NextResponse.json({ error: "department is required" }, { status: 400 })
    }

    await assertWeekIsMutable(supabase, meetingWeek, meetingYear)

    const { data: saved, error } = await supabase
      .from("kss_weekly_roster")
      .upsert(
        {
          meeting_week: meetingWeek,
          meeting_year: meetingYear,
          department,
          presenter_id: presenterId,
          notes,
          is_active: true,
          created_by: user.id,
        },
        { onConflict: "meeting_week,meeting_year" }
      )
      .select(
        "id, meeting_week, meeting_year, department, presenter_id, notes, is_active, created_by, created_at, updated_at"
      )
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await writeAuditLog(
      supabase as any,
      {
        action: "update",
        entityType: "communications_mail",
        entityId: saved.id,
        metadata: {
          event: "kss_roster_upserted",
          meeting_week: meetingWeek,
          meeting_year: meetingYear,
          department,
          presenter_id: presenterId,
        },
        context: {
          actorId: user.id,
          source: "api",
          route: "/api/reports/kss-roster",
          department,
        },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data: saved }, { status: 201 })
  } catch (error) {
    log.error({ err: String(error) }, "POST /api/reports/kss-roster failed")
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const scope = await resolveAdminScope(supabase as any, user.id)
    if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (!hasGlobalReportsWriteAccess(scope)) {
      return NextResponse.json({ error: "Only reports admins can update KSS roster entries" }, { status: 403 })
    }

    const body = await request.json()
    const id = String(body?.id || "")
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const { data: existing, error: fetchError } = await supabase
      .from("kss_weekly_roster")
      .select("id, department, meeting_week, meeting_year")
      .eq("id", id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Roster entry not found" }, { status: 404 })
    }

    await assertWeekIsMutable(supabase, existing.meeting_week, existing.meeting_year)

    const patch: Record<string, unknown> = {}
    if (typeof body?.department === "string" && body.department.trim()) {
      patch.department = normalizeDepartment(body.department)
    }
    if (body?.presenterId !== undefined) patch.presenter_id = body.presenterId ? String(body.presenterId) : null
    if (body?.notes !== undefined) patch.notes = body.notes ? String(body.notes) : null
    if (body?.isActive !== undefined) patch.is_active = Boolean(body.isActive)

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No patch fields provided" }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from("kss_weekly_roster")
      .update(patch)
      .eq("id", id)
      .select(
        "id, meeting_week, meeting_year, department, presenter_id, notes, is_active, created_by, created_at, updated_at"
      )
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await writeAuditLog(
      supabase as any,
      {
        action: "update",
        entityType: "communications_mail",
        entityId: updated.id,
        metadata: {
          event: "kss_roster_updated",
          patch,
        },
        context: {
          actorId: user.id,
          source: "api",
          route: "/api/reports/kss-roster",
          department: updated.department,
        },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data: updated })
  } catch (error) {
    log.error({ err: String(error) }, "PATCH /api/reports/kss-roster failed")
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const scope = await resolveAdminScope(supabase as any, user.id)
    if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (!hasGlobalReportsWriteAccess(scope)) {
      return NextResponse.json({ error: "Only reports admins can delete KSS roster entries" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = String(searchParams.get("id") || "")
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const { data: existing, error: fetchError } = await supabase
      .from("kss_weekly_roster")
      .select("id, department, meeting_week, meeting_year")
      .eq("id", id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Roster entry not found" }, { status: 404 })
    }

    await assertWeekIsMutable(supabase, existing.meeting_week, existing.meeting_year)
    const { error } = await supabase.from("kss_weekly_roster").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await writeAuditLog(
      supabase as any,
      {
        action: "delete",
        entityType: "communications_mail",
        entityId: id,
        metadata: {
          event: "kss_roster_deleted",
          department: existing.department,
        },
        context: {
          actorId: user.id,
          source: "api",
          route: "/api/reports/kss-roster",
          department: existing.department,
        },
      },
      { failOpen: true }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    log.error({ err: String(error) }, "DELETE /api/reports/kss-roster failed")
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
