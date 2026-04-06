import { Buffer } from "node:buffer"
import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { ActionItem } from "@/lib/export-utils"
import { logger } from "@/lib/logger"
import { getOneDriveService } from "@/lib/onedrive"
import { buildGeneratedReportExportPath } from "@/lib/reports/document-storage"
import { formatMeetingDateLabel, resolveEffectiveMeetingDateIso } from "@/lib/reports/meeting-date"
import { generateActionPointsPdfFromDocxBuffer } from "@/lib/reports/action-points-word-pdf"
import { fetchActionTrackerItems } from "@/lib/reports/action-tracker-data"
import {
  buildWeeklyReportPDF,
  fetchLogoPair,
  type WeeklyReportRow,
} from "@/lib/reports/weekly-report-pdf"

const log = logger("reports-official-pdf")

export type OfficialReportExportType = "weekly_report" | "action_point"
type ReportsPdfClient = Pick<SupabaseClient, "from" | "rpc">

export async function fetchActionPointRows(supabase: ReportsPdfClient, week: number, year: number) {
  const actions = await fetchActionTrackerItems(supabase, { week, year })
  return actions.map((action) => ({
    id: action.id,
    title: action.title || null,
    department: action.department,
    status: action.status,
    week_number: action.week_number,
    year: action.year,
  }))
}

export async function resolveOfficialReportExportMeta(
  supabase: ReportsPdfClient,
  params: { week: number; year: number; type: OfficialReportExportType }
) {
  const { week, year, type } = params
  const meetingDateIso = await resolveEffectiveMeetingDateIso(supabase, week, year)
  const meetingDateLabel = formatMeetingDateLabel(meetingDateIso)
  const filename =
    type === "weekly_report"
      ? `ACOB Weekly Reports - ${meetingDateLabel} - W${week}.pdf`
      : `ACOB Action Points - ${meetingDateLabel} - W${week}.pdf`
  const storagePath = buildGeneratedReportExportPath({
    meetingYear: year,
    meetingWeek: week,
    exportType: type === "weekly_report" ? "weekly-reports" : "action-points",
    fileName: filename,
  })

  return {
    filename,
    storagePath,
    meetingDateIso,
    meetingDateLabel,
  }
}

export async function buildOfficialReportPdf(
  supabase: ReportsPdfClient,
  params: { week: number; year: number; type: OfficialReportExportType }
) {
  const { week, year, type } = params
  const { filename, storagePath, meetingDateIso, meetingDateLabel } = await resolveOfficialReportExportMeta(
    supabase,
    params
  )

  let pdfBytes: Uint8Array

  if (type === "weekly_report") {
    const [{ coverLogoBytes, headerLogoBytes }, reportsResult] = await Promise.all([
      fetchLogoPair(),
      supabase
        .from("weekly_reports")
        .select("id, department, week_number, year, work_done, tasks_new_week, challenges, status")
        .eq("week_number", week)
        .eq("year", year)
        .eq("status", "submitted"),
    ])

    if (reportsResult.error) throw new Error(reportsResult.error.message)

    const reports = (reportsResult.data ?? []) as WeeklyReportRow[]
    if (reports.length === 0) {
      throw new Error(`No submitted weekly reports found for W${week}/${year}`)
    }

    pdfBytes = await buildWeeklyReportPDF(reports, week, year, meetingDateLabel, coverLogoBytes, headerLogoBytes)
  } else {
    const actions = await fetchActionPointRows(supabase, week, year)
    if (actions.length === 0) {
      throw new Error(`No action points found for W${week}/${year}`)
    }

    const normalizedActions: ActionItem[] = actions.map((action) => ({
      id: String(action.id),
      title: typeof action.title === "string" ? action.title : "",
      department: String(action.department || ""),
      status: String(action.status || ""),
      week_number: Number(action.week_number || week),
      year: Number(action.year || year),
    }))
    pdfBytes = await generateActionPointsPdfFromDocxBuffer(normalizedActions, week, year, meetingDateIso)
  }

  return {
    pdfBytes,
    filename,
    storagePath,
  }
}

export async function tryReadStoredOfficialPdf(filePath: string): Promise<Uint8Array | null> {
  const onedrive = getOneDriveService()
  if (!onedrive.isEnabled()) return null

  try {
    const downloadUrl = await onedrive.getDownloadUrl(filePath)
    const response = await fetch(downloadUrl)
    if (!response.ok) return null
    return new Uint8Array(await response.arrayBuffer())
  } catch (error) {
    log.warn({ err: String(error), filePath }, "Stored official PDF lookup failed")
    return null
  }
}

export async function persistOfficialPdf(filePath: string, pdfBytes: Uint8Array): Promise<void> {
  const onedrive = getOneDriveService()
  if (!onedrive.isEnabled()) return

  const folderPath = filePath.slice(0, filePath.lastIndexOf("/"))
  await onedrive.createFolder(folderPath)
  await onedrive.uploadFile(filePath, pdfBytes, "application/pdf")
}

export function buildPdfDownloadResponse(pdfBytes: Uint8Array, filename: string) {
  const safeFilename = encodeURIComponent(filename)
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${safeFilename}`,
    },
  })
}
