import { NextRequest, NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { getCurrentOfficeWeek, getOfficeWeekFromDate, getOfficeWeekMonday } from "@/lib/meeting-week"
import { toLocalISODate } from "@/lib/utils/date"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { isSameDepartment } from "@/shared/departments"

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

type ProfileRow = {
  id: string
  full_name: string | null
  department: string | null
  company_email: string | null
  additional_email: string | null
  is_department_lead: boolean | null
  lead_departments: string[] | null
}

type HeadsUpLogRow = {
  meeting_week: number
  meeting_year: number
  sent_at: string | null
  recipient_count: number | null
  outcome: string | null
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
  heads_up_day: z.number().int().min(1).max(7),
  include_department_members: z.boolean(),
  extra_recipient_ids: z.array(z.string().uuid()).max(50),
})

const WeekFields = {
  meeting_week: z.number().int().min(1).max(53),
  meeting_year: z.number().int().min(2000).max(2100),
}

const PostSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("skip"), ...WeekFields, reason: z.string().trim().max(200).optional().nullable() }),
  z.object({ action: z.literal("send"), ...WeekFields }),
  z.object({ action: z.literal("preview"), ...WeekFields, email: z.string().trim().email("Enter a valid email") }),
])

/** Mirrors send-kss-heads-up so the page shows exactly who a send would reach. */
function resolveRecipientNames(
  profiles: ProfileRow[],
  department: string,
  includeDepartment: boolean,
  extraIds: Set<string>
): string[] {
  const leads = (profile: ProfileRow) =>
    Boolean(profile.is_department_lead) &&
    (isSameDepartment(profile.department, department) ||
      (profile.lead_departments || []).some((managed) => isSameDepartment(managed, department)))
  return profiles
    .filter((profile) => Boolean((profile.company_email || profile.additional_email || "").trim()))
    .filter(
      (profile) =>
        extraIds.has(profile.id) ||
        (includeDepartment && (isSameDepartment(profile.department, department) || leads(profile)))
    )
    .map((profile) => profile.full_name || "Unnamed")
}

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

    const [settingsResult, skipsResult, departmentsResult, profilesResult, logResult] = await Promise.all([
      db.from("system_settings").select("value").eq("key", SETTINGS_KEY).maybeSingle(),
      db
        .from("kss_rotation_skips")
        .select("id, meeting_week, meeting_year, reason, created_at")
        .order("meeting_year", { ascending: false })
        .order("meeting_week", { ascending: false }),
      db.from("departments").select("name").order("name"),
      db
        .from("profiles")
        .select("id, full_name, department, company_email, additional_email, is_department_lead, lead_departments")
        .eq("employment_status", "active")
        .order("full_name"),
      db.from("kss_heads_up_log").select("meeting_week, meeting_year, sent_at, recipient_count, outcome"),
    ])
    if (settingsResult.error) throw new Error(settingsResult.error.message)
    if (skipsResult.error) throw new Error(skipsResult.error.message)
    if (departmentsResult.error) throw new Error(departmentsResult.error.message)
    if (profilesResult.error) throw new Error(profilesResult.error.message)
    if (logResult.error) throw new Error(logResult.error.message)

    const settings = (settingsResult.data?.value ?? {}) as {
      include_department_members?: boolean
      extra_recipient_ids?: string[]
    }
    const profiles = (profilesResult.data ?? []) as ProfileRow[]
    const extraIds = new Set(Array.isArray(settings.extra_recipient_ids) ? settings.extra_recipient_ids : [])
    const includeDepartment = settings.include_department_members !== false
    const logByWeek = new Map(
      ((logResult.data ?? []) as HeadsUpLogRow[]).map((row) => [`${row.meeting_year}-${row.meeting_week}`, row])
    )

    // Preview from the current office week, one Monday at a time.
    const current = getCurrentOfficeWeek()
    const firstMonday = getOfficeWeekMonday(current.week, current.year)
    const preview = []
    for (let i = 0; i < PREVIEW_WEEKS; i++) {
      const monday = new Date(firstMonday.getFullYear(), firstMonday.getMonth(), firstMonday.getDate() + i * 7)
      const { week, year } = getOfficeWeekFromDate(monday)
      const resolved = await resolveWeek(db, week, year)
      const logRow = logByWeek.get(`${year}-${week}`)
      preview.push({
        week,
        year,
        date: toLocalISODate(monday),
        ...resolved,
        recipients: resolved?.department
          ? resolveRecipientNames(profiles, resolved.department, includeDepartment, extraIds)
          : [],
        heads_up: logRow
          ? { sent_at: logRow.sent_at, recipient_count: logRow.recipient_count, outcome: logRow.outcome }
          : null,
      })
    }

    return NextResponse.json({
      data: {
        settings: settingsResult.data?.value ?? null,
        skips: (skipsResult.data ?? []) as SkipRow[],
        departmentOptions: ((departmentsResult.data ?? []) as Array<{ name: string }>).map((row) => row.name),
        preview,
        employeeOptions: profiles
          .filter((profile) => Boolean((profile.company_email || profile.additional_email || "").trim()))
          .map((profile) => ({
            id: profile.id,
            full_name: profile.full_name,
            department: profile.department,
            is_department_lead: Boolean(profile.is_department_lead),
            lead_departments: profile.lead_departments ?? [],
          })),
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

  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null
  // A skip posted without an action (the original request shape) still works.
  const parsed = PostSchema.safeParse(raw && !raw.action ? { ...raw, action: "skip" } : raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }
  const input = parsed.data
  const route = "/api/admin/communications/kss-rotation"

  if (input.action === "send" || input.action === "preview") {
    const rl = await rateLimit(`kss-heads-up-send:${auth.scope.userId}:${getClientId(request)}`, {
      limit: 10,
      windowSec: 60,
    })
    if (!rl.allowed) return NextResponse.json({ error: "Too many sends. Try again shortly." }, { status: 429 })

    const { error } = await db.rpc("dispatch_kss_heads_up", {
      p_week: input.meeting_week,
      p_year: input.meeting_year,
      p_preview_to: input.action === "preview" ? input.email : null,
    })
    if (error) {
      log.error({ err: error.message }, "KSS heads-up dispatch failed")
      return NextResponse.json({ error: error.message || "Failed to send heads-up" }, { status: 500 })
    }

    await writeAuditLog(
      db,
      {
        action: "send",
        entityType: "communications_mail",
        entityId: `kss-heads-up-${input.meeting_year}-${input.meeting_week}`,
        newValues: {
          event: input.action === "preview" ? "kss_heads_up_preview" : "kss_heads_up_sent_manually",
          meeting_week: input.meeting_week,
          meeting_year: input.meeting_year,
          ...(input.action === "preview" ? { preview_to: input.email } : {}),
        },
        context: { actorId: auth.scope.userId, source: "api", route },
      },
      { failOpen: true }
    )
    return NextResponse.json({ ok: true, queued: true })
  }

  const { data, error } = await db
    .from("kss_rotation_skips")
    .insert({
      meeting_week: input.meeting_week,
      meeting_year: input.meeting_year,
      reason: input.reason || null,
      created_by: auth.scope.userId,
    })
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
      newValues: { event: "kss_week_skipped", meeting_week: input.meeting_week, meeting_year: input.meeting_year },
      context: { actorId: auth.scope.userId, source: "api", route },
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
