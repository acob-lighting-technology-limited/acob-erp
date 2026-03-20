"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FileSpreadsheet, FileText, File as FileIcon, Presentation, ExternalLink } from "lucide-react"
import { exportActionPointsDocx, exportActionPointsPdf } from "@/lib/action-points-export"
import { exportActionTrackerToPPTX, exportActionTrackerToXLSX, type ActionItem } from "@/lib/export-utils"

interface ActionTrackerExportButtonsProps {
  items: ActionItem[]
  weekFilter: number
  yearFilter: number
  meetingDate?: string
}

export function ActionTrackerExportButtons({
  items,
  weekFilter,
  yearFilter,
  meetingDate,
}: ActionTrackerExportButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        onClick={() => exportActionPointsPdf(items, weekFilter, yearFilter, meetingDate)}
        className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/30 dark:hover:bg-red-950/20"
      >
        <FileText className="h-4 w-4" /> <span className="hidden sm:inline">PDF</span>
      </Button>
      <Button
        variant="outline"
        onClick={() => exportActionTrackerToPPTX(items, weekFilter, yearFilter, meetingDate)}
        className="gap-2 border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700 dark:border-orange-900/30 dark:hover:bg-orange-950/20"
      >
        <Presentation className="h-4 w-4" /> <span className="hidden sm:inline">PPTX</span>
      </Button>
      <Button
        variant="outline"
        onClick={() => exportActionPointsDocx(items, weekFilter, yearFilter, meetingDate)}
        className="gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-900/30 dark:hover:bg-blue-950/20"
      >
        <FileIcon className="h-4 w-4" /> <span className="hidden sm:inline">Word</span>
      </Button>
      <Button
        variant="outline"
        onClick={() => exportActionTrackerToXLSX(items, weekFilter, yearFilter, undefined, meetingDate)}
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
    </div>
  )
}
