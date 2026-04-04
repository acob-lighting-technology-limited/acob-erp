"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { FileText, File as FileIcon, Presentation, Plus, ExternalLink, FileSpreadsheet, Download } from "lucide-react"
import { toast } from "sonner"
import { exportAllToDocx, exportAllToXLSX, type WeeklyReport } from "@/lib/export-utils"
import { downloadWeeklyReportPdf } from "@/lib/reports/export-download"

interface MeetingDocumentHelper {
  id: string
  file_name: string
  signed_url: string | null
}

interface WeeklyReportExportActionsProps {
  filteredReports: WeeklyReport[]
  weekFilter: number
  yearFilter: number
  meetingDate: string
  kssDocument: MeetingDocumentHelper | null
  minutesDocument: MeetingDocumentHelper | null
  onDownloadDocument: (document: MeetingDocumentHelper) => void
  onOpenAllPptx: () => void
  onAddReport: () => void
}

export function WeeklyReportExportActions({
  filteredReports,
  weekFilter,
  yearFilter,
  meetingDate,
  kssDocument,
  minutesDocument,
  onDownloadDocument,
  onOpenAllPptx,
  onAddReport,
}: WeeklyReportExportActionsProps) {
  const handlePdfDownload = async () => {
    const toastId = toast.loading("Preparing weekly report PDF...")
    try {
      await downloadWeeklyReportPdf({ week: weekFilter, year: yearFilter })
      toast.success("Weekly report PDF ready", { id: toastId })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export weekly report PDF", { id: toastId })
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filteredReports.length > 0 && (
        <>
          <Button
            variant="outline"
            onClick={handlePdfDownload}
            className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/30 dark:hover:bg-red-950/20"
          >
            <FileText className="h-4 w-4" /> <span className="hidden sm:inline">PDF</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => exportAllToDocx(filteredReports, weekFilter, yearFilter, meetingDate)}
            className="gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-900/30 dark:hover:bg-blue-950/20"
          >
            <FileIcon className="h-4 w-4" /> <span className="hidden sm:inline">Word</span>
          </Button>
          <Button
            variant="outline"
            onClick={onOpenAllPptx}
            className="gap-2 border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700 dark:border-orange-900/30 dark:hover:bg-orange-950/20"
          >
            <Presentation className="h-4 w-4" /> <span className="hidden sm:inline">PPTX</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => exportAllToXLSX(filteredReports, weekFilter, yearFilter, meetingDate)}
            className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-900/30 dark:hover:bg-emerald-950/20"
          >
            <FileSpreadsheet className="h-4 w-4" /> <span className="hidden sm:inline">XLSX</span>
          </Button>
          <Button
            asChild
            variant="outline"
            className="gap-2 border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-900/30 dark:hover:bg-green-950/20"
          >
            <Link href="/admin/communications/meetings/mail">
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">General Meeting Mail</span>
            </Link>
          </Button>
        </>
      )}
      <Button
        variant="outline"
        className="gap-2 border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-800 dark:hover:bg-slate-950/20"
        onClick={() => kssDocument && onDownloadDocument(kssDocument)}
        disabled={!kssDocument?.signed_url}
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Download KSS</span>
      </Button>
      <Button
        variant="outline"
        className="gap-2 border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-800 dark:hover:bg-slate-950/20"
        onClick={() => minutesDocument && onDownloadDocument(minutesDocument)}
        disabled={!minutesDocument?.signed_url}
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Download Minutes</span>
      </Button>
      <Button onClick={onAddReport} className="gap-2">
        <Plus className="h-4 w-4" /> Add Report
      </Button>
    </div>
  )
}
