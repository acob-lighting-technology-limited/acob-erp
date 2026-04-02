/**
 * POST /api/reports/weekly-report-export
 *
 * Pre-generates the Weekly Report PDF (and optionally the Action Points PDF)
 * server-side inside a Next.js API route, returning the raw PDF bytes.
 *
 * The send flow calls this BEFORE invoking the edge function so that the edge
 * function never has to run the CPU-heavy pdf-lib code itself — it just
 * receives a pre-built base64 payload and spends its CPU budget on sending
 * emails only.
 */

import { NextRequest, NextResponse } from "next/server"
import type { ActionItem } from "@/lib/export-utils"
import { createClient } from "@/lib/supabase/server"
import {
  buildWeeklyReportPDF,
  fetchLogoPair,
  type WeeklyReportRow,
  type ActionItemRow,
} from "@/lib/reports/weekly-report-pdf"
import { resolveEffectiveMeetingDateIso, formatMeetingDateLabel } from "@/lib/reports/meeting-date"
import { generateActionPointsPdfFromDocxBuffer } from "@/lib/reports/action-points-word-pdf"

type RequestBody = {
  week: number
  year: number
  /** "weekly_report" | "action_point" — defaults to "weekly_report" */
  type?: "weekly_report" | "action_point"
}

type ActionPointRouteRow = {
  id: string
  title: string | null
  department: string
  status: string
  week_number: number
  year: number
}

async function fetchActionPointRows(supabase: Awaited<ReturnType<typeof createClient>>, week: number, year: number) {
  const { data: taskRows, error: taskError } = await supabase
    .from("tasks")
    .select("id, title, department, status, week_number, year")
    .eq("category", "weekly_action")
    .eq("week_number", week)
    .eq("year", year)

  if (taskError) throw new Error(taskError.message)

  const normalizedTaskRows: ActionItemRow[] = Array.isArray(taskRows)
    ? taskRows.map((row) => ({
        id: String(row.id),
        title: typeof row.title === "string" ? row.title : null,
        department: String(row.department || ""),
        status: String(row.status || ""),
        week_number: Number(row.week_number || week),
        year: Number(row.year || year),
      }))
    : []

  if (normalizedTaskRows.length > 0) return normalizedTaskRows

  const { data: legacyRows, error: legacyError } = await supabase
    .from("action_items")
    .select("id, title, department, status, week_number, year")
    .eq("week_number", week)
    .eq("year", year)

  if (legacyError) throw new Error(legacyError.message)

  return (Array.isArray(legacyRows) ? legacyRows : []).map((row: ActionPointRouteRow) => ({
    id: String(row.id),
    title: typeof row.title === "string" ? row.title : null,
    department: String(row.department || ""),
    status: String(row.status || ""),
    week_number: Number(row.week_number || week),
    year: Number(row.year || year),
  }))
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody
    const { week, year, type = "weekly_report" } = body

    if (!week || !year) {
      return NextResponse.json({ error: "week and year are required" }, { status: 400 })
    }

    const supabase = await createClient()

    // ── Resolve meeting date label ──────────────────────────────────────────
    const meetingDateIso = await resolveEffectiveMeetingDateIso(supabase, week, year)
    const meetingDateLabel = formatMeetingDateLabel(meetingDateIso)

    const [{ coverLogoBytes, headerLogoBytes }, reportsResult, actionsResult] = await Promise.all([
      fetchLogoPair(),
      type === "weekly_report"
        ? supabase
            .from("weekly_reports")
            .select("id, department, week_number, year, work_done, tasks_new_week, challenges, status")
            .eq("week_number", week)
            .eq("year", year)
            .eq("status", "submitted")
        : Promise.resolve({ data: [], error: null }),
      type === "action_point" ? fetchActionPointRows(supabase, week, year) : Promise.resolve([] as ActionItemRow[]),
    ])

    // ── Generate the requested PDF ──────────────────────────────────────────
    let pdfBytes: Uint8Array
    let filename: string

    if (type === "weekly_report") {
      if (reportsResult.error) throw new Error(reportsResult.error.message)

      const reports = (reportsResult.data ?? []) as WeeklyReportRow[]
      if (reports.length === 0) {
        return NextResponse.json({ error: `No submitted weekly reports found for W${week}/${year}` }, { status: 404 })
      }

      pdfBytes = await buildWeeklyReportPDF(reports, week, year, meetingDateLabel, coverLogoBytes, headerLogoBytes)
      filename = `ACOB Weekly Reports - ${meetingDateLabel} - W${week}.pdf`
    } else {
      const actions = actionsResult as ActionItemRow[]
      const normalizedActions: ActionItem[] = actions.map((action) => ({
        id: String(action.id),
        title: typeof action.title === "string" ? action.title : "",
        department: String(action.department || ""),
        status: String(action.status || ""),
        week_number: Number(action.week_number || week),
        year: Number(action.year || year),
      }))
      pdfBytes = await generateActionPointsPdfFromDocxBuffer(normalizedActions, week, year, meetingDateIso)
      filename = `ACOB Action Points - ${meetingDateLabel} - W${week}.pdf`
    }

    const safeFilename = encodeURIComponent(filename)

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${safeFilename}`,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate PDF"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
