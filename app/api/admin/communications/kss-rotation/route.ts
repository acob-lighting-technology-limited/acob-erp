import { NextRequest, NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { getCurrentOfficeWeek, getOfficeWeekFromDate, getOfficeWeekMonday } from "@/lib/meeting-week"
import { toLocalISODate } from "@/lib/utils/date"

export const dynamic = "force-dynamic"

const log = logger("api-kss-rotation")
const SETTINGS_KEY = "kss_rotation"
const PREVIEW_WEEKS = 10

type ResolvedWeek = {
  department: string | null
  presenter_id: string | null
  presenter_name: string | null
  presenter_department: string | null
  source: "roster" | "rotation" | "no_session" | "unconfigured" | "before_start"
}

type SkipRow = { id: string; meeting_week: number; meeting_year: number; reason: string | null; created_at: string }

const SettingsSchema = z.object({
  departments: z
    .array(z.string().trim().min(1))
    .min(1, "Add at least one department")
    .refine(
      (list) => new Set(list.map((d) => d.toLowerCase())).size === list.length,
      "Each department can appear once"
    ),
  anchor_week: z.number().int().min(1).max(53),
  anchor_year: z.number().int().min(2000).max(2100),
  heads_up_enabled: z.boolean(),
  heads_up_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour)"),
})

const SkipSchema = z.object({
  meeting_week: z.number().int().min(1).max(53),
  meeting_year: z.number().int().min(2000).max(2100),
  reason: z.string().trim().max(200).optional().nullable(),
})

async function requireAdmin() {
  const scopeResult = await requireApiAdminScope()
  if (!scopeResult.ok) return scopeResult
  if (!scopeResult.scope.isAdminLike) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return scopeResult
}

async function resolveWeek(db: SupabaseClient, week: number, year: number): Promise<ResolvedWeek | null> {
  const { data, error } = await db.rpc("kss_department_for_week", { p_week: week, p_year: year })
  if (error) throw new Error(error.message)
  return ((data as ResolvedWeek[] | null) ?? [])[0] ?? null
}

// GET ?week=&year=  -> the resolved department for one week (used by the composer)
// GET               -> settings, skipped weeks, department options and a preview
export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const db = getServiceRoleClientOrFallback(auth.supabase)

  try {
    const weekParam = Number(request.nextUrl.searchParams.get("week"))
    const yearParam = Number(request.nextUrl.searchParams.get("year"))
    if (Number.isInteger(weekParam) && weekParam > 0 && Number.isInteger(yearParam) && yearParam > 0) {
      return NextResponse.json({ data: await resolveWeek(db, weekParam, yearParam) })
    }

    const [settingsResult, skipsResult, departmentsResult] = await Promise.all([
      db.from("system_settings").select("value").eq("key", SETTINGS_KEY).maybeSingle(),
      db
        .from("kss_rotation_skips")
        .select("id, meeting_week, meeting_year, reason, created_at")
        .order("meeting_year", { ascending: false })
        .order("meeting_week", { ascending: false }),
      db.from("departments").select("name").order("name"),
    ])
    if (settingsResult.error) throw new Error(settingsResult.error.message)
    if (skipsResult.error) throw new Error(skipsResult.error.message)
    if (departmentsResult.error) throw new Error(departmentsResult.error.message)

    // Preview from the current office week, one Monday at a time.
    const current = getCurrentOfficeWeek()
    const firstMonday = getOfficeWeekMonday(current.week, current.year)
    const preview = []
    for (let i = 0; i < PREVIEW_WEEKS; i++) {
      const monday = new Date(firstMonday.getFullYear(), firstMonday.getMonth(), firstMonday.getDate() + i * 7)
      const { week, year } = getOfficeWeekFromDate(monday)
      preview.push({ week, year, date: toLocalISODate(monday), ...(await resolveWeek(db, week, year)) })
    }

    return NextResponse.json({
      data: {
        settings: settingsResult.data?.value ?? null,
        skips: (skipsResult.data ?? []) as SkipRow[],
        departmentOptions: ((departmentsResult.data ?? []) as Array<{ name: string }>).map((row) => row.name),
        preview,
      },
    })
  } catch (error) {
    log.error({ err: String(error) }, "Failed to load KSS rotation")
    return NextResponse.json({ error: "Failed to load KSS rotation" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const db = getServiceRoleClientOrFallback(auth.supabase)

  const parsed = SettingsSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid settings" }, { status: 400 })
  }

  const { data: departments, error: deptError } = await db.from("departments").select("name")
  if (deptError) return NextResponse.json({ error: "Failed to validate departments" }, { status: 500 })
  const known = new Set(((departments ?? []) as Array<{ name: string }>).map((row) => row.name))
  const unknown = parsed.data.departments.find((name) => !known.has(name))
  if (unknown) return NextResponse.json({ error: `Unknown department: ${unknown}` }, { status: 400 })

  const { error } = await db
    .from("system_settings")
    .upsert(
      { key: SETTINGS_KEY, value: parsed.data, updated_at: new Date().toISOString(), updated_by: auth.scope.userId },
      { onConflict: "key" }
    )
  if (error) {
    log.error({ err: error.message }, "Failed to save KSS rotation")
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
  }

  await writeAuditLog(
    db,
    {
      action: "update",
      entityType: "communications_mail",
      entityId: SETTINGS_KEY,
      newValues: parsed.data,
      context: { actorId: auth.scope.userId, source: "api", route: "/api/admin/communications/kss-rotation" },
    },
    { failOpen: true }
  )
  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const db = getServiceRoleClientOrFallback(auth.supabase)

  const parsed = SkipSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid week" }, { status: 400 })
  }

  const { data, error } = await db
    .from("kss_rotation_skips")
    .insert({ ...parsed.data, reason: parsed.data.reason || null, created_by: auth.scope.userId })
    .select("id")
    .single()
  if (error) {
    const duplicate = error.code === "23505"
    return NextResponse.json(
      { error: duplicate ? "That week is already marked as no session" : "Failed to mark week" },
      { status: duplicate ? 409 : 500 }
    )
  }

  await writeAuditLog(
    db,
    {
      action: "create",
      entityType: "communications_mail",
      entityId: String((data as { id: string }).id),
      newValues: { event: "kss_week_skipped", ...parsed.data },
      context: { actorId: auth.scope.userId, source: "api", route: "/api/admin/communications/kss-rotation" },
    },
    { failOpen: true }
  )
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const db = getServiceRoleClientOrFallback(auth.supabase)

  const id = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const { error } = await db.from("kss_rotation_skips").delete().eq("id", id)
  if (error) return NextResponse.json({ error: "Failed to remove week" }, { status: 500 })

  await writeAuditLog(
    db,
    {
      action: "delete",
      entityType: "communications_mail",
      entityId: id,
      newValues: { event: "kss_week_unskipped" },
      context: { actorId: auth.scope.userId, source: "api", route: "/api/admin/communications/kss-rotation" },
    },
    { failOpen: true }
  )
  return NextResponse.json({ ok: true })
}
