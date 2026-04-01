/**
 * POST /api/reports/weekly-report-export
 *
 * Pre-generates the Weekly Report PDF (and optionally the Action Tracker PDF)
 * server-side inside a Next.js API route, returning the raw PDF bytes.
 *
 * The send flow calls this BEFORE invoking the edge function so that the edge
 * function never has to run the CPU-heavy pdf-lib code itself — it just
 * receives a pre-built base64 payload and spends its CPU budget on sending
 * emails only.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  buildWeeklyReportPDF,
  buildActionTrackerPdf,
  fetchLogoPair,
  type WeeklyReportRow,
  type ActionItemRow,
} from "@/lib/reports/weekly-report-pdf"
import { resolveEffectiveMeetingDateIso, formatMeetingDateLabel } from "@/lib/reports/meeting-date"

type RequestBody = {
  week: number
  year: number
  /** "weekly_report" | "action_tracker" — defaults to "weekly_report" */
  type?: "weekly_report" | "action_tracker"
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

    // ── Fetch logos in parallel with data ───────────────────────────────────
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
      type === "action_tracker"
        ? supabase
            .from("action_items")
            .select("id, title, department, status, week_number, year")
            .eq("week_number", week)
            .eq("year", year)
        : Promise.resolve({ data: [], error: null }),
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
      if (actionsResult.error) throw new Error(actionsResult.error.message)

      const actions = (actionsResult.data ?? []) as ActionItemRow[]
      pdfBytes = await buildActionTrackerPdf(actions, week, year, headerLogoBytes)
      filename = `ACOB Action Tracker - ${meetingDateLabel} - W${week}.pdf`
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
