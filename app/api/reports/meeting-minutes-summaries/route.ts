import { NextResponse } from "next/server"
import { z } from "zod"
import { canOverrideReportsWeekLock, hasGlobalReportsWriteAccess, resolveAdminScope } from "@/lib/admin/rbac"
import { serverError } from "@/lib/api/errors"
import { parseJsonBody } from "@/lib/api/parse-body"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

/**
 * Summary of minutes, one per meeting week (see the
 * 20261031120000_meeting_minutes_summaries migration). Any signed-in user may
 * read; reports admins write, through the service-role client, since
 * authenticated holds no write grant on the table.
 */

const log = logger("api-reports-meeting-minutes-summaries")
const ROUTE = "/api/reports/meeting-minutes-summaries"
const COLUMNS = "id, meeting_week, meeting_year, content_html, created_by, updated_by, created_at, updated_at"

const WeekYear = {
  meetingWeek: z.number().int().min(1).max(53),
  meetingYear: z.number().int().min(2000).max(2100),
}

const SaveSchema = z.object({
  ...WeekYear,
  contentHtml: z.string().min(1).max(200_000),
})

/** True when the HTML holds some visible text, not just empty tags. */
const hasText = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim().length > 0

async function requireWriter() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const scope = await resolveAdminScope(supabase, user.id)
  if (!scope || !hasGlobalReportsWriteAccess(scope)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Only reports admins can edit minutes summaries" }, { status: 403 }),
    }
  }
  return { ok: true as const, supabase, user, scope }
}

/**
 * Same rule as meeting documents: a locked week can still get its first
 * summary, but an existing one can no longer be changed or removed — unless the
 * caller may override week locks.
 */
async function weekIsWritable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  meetingWeek: number,
  meetingYear: number,
  hasExisting: boolean
) {
  const { data, error } = await supabase.rpc("weekly_report_can_mutate", { p_week: meetingWeek, p_year: meetingYear })
  if (error) throw new Error(error.message)
  return Boolean(data) || !hasExisting
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const week = Number(searchParams.get("week") || "")
    const year = Number(searchParams.get("year") || "")

    let query = supabase
      .from("meeting_minutes_summaries")
      .select(COLUMNS)
      .order("meeting_year", { ascending: false })
      .order("meeting_week", { ascending: false })
    if (Number.isInteger(week) && week > 0) query = query.eq("meeting_week", week)
    if (Number.isInteger(year) && year > 0) query = query.eq("meeting_year", year)

    const { data, error } = await query
    if (error) return serverError(log, error)
    return NextResponse.json({ data: data || [] })
  } catch (error) {
    return serverError(log, error)
  }
}

export async function PUT(request: Request) {
  const rl = await rateLimit(`reports-minutes-summaries:${getClientId(request)}`, { limit: 30, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })

  try {
    const auth = await requireWriter()
    if (!auth.ok) return auth.response
    const parsed = await parseJsonBody(request, SaveSchema)
    if (!parsed.ok) return parsed.response
    const { meetingWeek, meetingYear, contentHtml } = parsed.data
    if (!hasText(contentHtml)) return NextResponse.json({ error: "The summary is empty" }, { status: 400 })

    const db = getServiceRoleClientOrFallback(auth.supabase)
    const { data: existing, error: existingError } = await db
      .from("meeting_minutes_summaries")
      .select("id")
      .eq("meeting_week", meetingWeek)
      .eq("meeting_year", meetingYear)
      .maybeSingle()
    if (existingError) return serverError(log, existingError)

    if (
      !canOverrideReportsWeekLock(auth.scope) &&
      !(await weekIsWritable(auth.supabase, meetingWeek, meetingYear, Boolean(existing)))
    ) {
      return NextResponse.json(
        { error: `Week ${meetingWeek}, ${meetingYear} is locked and can no longer be changed` },
        { status: 409 }
      )
    }

    const now = new Date().toISOString()
    const { data: saved, error } = existing
      ? await db
          .from("meeting_minutes_summaries")
          .update({ content_html: contentHtml, updated_by: auth.user.id, updated_at: now })
          .eq("id", existing.id)
          .select(COLUMNS)
          .single()
      : await db
          .from("meeting_minutes_summaries")
          .insert({
            meeting_week: meetingWeek,
            meeting_year: meetingYear,
            content_html: contentHtml,
            created_by: auth.user.id,
            updated_by: auth.user.id,
          })
          .select(COLUMNS)
          .single()
    if (error || !saved) return serverError(log, error, "Failed to save the summary")

    await writeAuditLog(
      auth.supabase,
      {
        action: existing ? "update" : "create",
        entityType: "mail_summary",
        entityId: saved.id,
        metadata: { event: "meeting_minutes_summary_saved", meeting_week: meetingWeek, meeting_year: meetingYear },
        context: { actorId: auth.user.id, source: "api", route: ROUTE },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data: saved }, { status: existing ? 200 : 201 })
  } catch (error) {
    return serverError(log, error)
  }
}

export async function DELETE(request: Request) {
  const rl = await rateLimit(`reports-minutes-summaries:${getClientId(request)}`, { limit: 30, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })

  try {
    const auth = await requireWriter()
    if (!auth.ok) return auth.response
    const id = z.string().uuid().safeParse(new URL(request.url).searchParams.get("id"))
    if (!id.success) return NextResponse.json({ error: "A valid id is required" }, { status: 400 })

    const db = getServiceRoleClientOrFallback(auth.supabase)
    const { data: row, error: rowError } = await db
      .from("meeting_minutes_summaries")
      .select("id, meeting_week, meeting_year")
      .eq("id", id.data)
      .maybeSingle()
    if (rowError) return serverError(log, rowError)
    if (!row) return NextResponse.json({ error: "Summary not found" }, { status: 404 })

    if (
      !canOverrideReportsWeekLock(auth.scope) &&
      !(await weekIsWritable(auth.supabase, row.meeting_week, row.meeting_year, true))
    ) {
      return NextResponse.json(
        { error: `Week ${row.meeting_week}, ${row.meeting_year} is locked and can no longer be changed` },
        { status: 409 }
      )
    }

    const { error } = await db.from("meeting_minutes_summaries").delete().eq("id", row.id)
    if (error) return serverError(log, error, "Failed to delete the summary")

    await writeAuditLog(
      auth.supabase,
      {
        action: "delete",
        entityType: "mail_summary",
        entityId: row.id,
        metadata: {
          event: "meeting_minutes_summary_deleted",
          meeting_week: row.meeting_week,
          meeting_year: row.meeting_year,
        },
        context: { actorId: auth.user.id, source: "api", route: ROUTE },
      },
      { failOpen: true }
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError(log, error)
  }
}
