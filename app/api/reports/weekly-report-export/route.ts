import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import {
  buildOfficialReportPdf,
  buildPdfDownloadResponse,
  persistOfficialPdf,
  resolveOfficialReportExportMeta,
  tryReadStoredOfficialPdf,
} from "@/lib/reports/official-pdf"

const log = logger("api-reports-weekly-report-export")

type RequestBody = {
  week: number
  year: number
  type?: "weekly_report" | "action_point"
  persist?: boolean
  reuseStored?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody
    const { week, year, type = "weekly_report", persist = false, reuseStored = false } = body

    if (!week || !year) {
      return NextResponse.json({ error: "week and year are required" }, { status: 400 })
    }

    const supabase = await createClient()

    if (persist && reuseStored) {
      const storedMeta = await resolveOfficialReportExportMeta(supabase, { week, year, type })
      const storedBytes = await tryReadStoredOfficialPdf(storedMeta.storagePath)
      if (storedBytes) {
        return buildPdfDownloadResponse(storedBytes, storedMeta.filename)
      }
    }

    const { pdfBytes, filename, storagePath } = await buildOfficialReportPdf(supabase, { week, year, type })

    if (persist) {
      try {
        await persistOfficialPdf(storagePath, pdfBytes)
      } catch (error) {
        log.warn({ err: String(error), storagePath }, "Failed to persist weekly export to SharePoint")
      }
    }

    return buildPdfDownloadResponse(pdfBytes, filename)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate PDF"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
