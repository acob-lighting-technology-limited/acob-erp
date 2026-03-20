"use client"

import { Button } from "@/components/ui/button"
import { FileSpreadsheet, FileText, File as FileIcon, Presentation } from "lucide-react"
import { exportActionPointsDocx, exportActionPointsPdf } from "@/lib/action-points-export"
import { exportActionTrackerToPPTX, exportActionTrackerToXLSX, type ActionItem } from "@/lib/export-utils"

interface ActionTrackerExportButtonsProps {
  actionItems: ActionItem[]
  week: number
  year: number
  meetingDate?: string
}

export function ActionTrackerExportButtons({ actionItems, week, year, meetingDate }: ActionTrackerExportButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => exportActionPointsPdf(actionItems, week, year, meetingDate)}
        className="gap-2 border-red-200 text-red-600"
      >
        <FileText className="h-4 w-4" /> PDF
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => exportActionTrackerToPPTX(actionItems, week, year, meetingDate)}
        className="gap-2 border-orange-200 text-orange-600"
      >
        <Presentation className="h-4 w-4" /> PPTX
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => exportActionPointsDocx(actionItems, week, year, meetingDate)}
        className="gap-2 border-blue-200 text-blue-600"
      >
        <FileIcon className="h-4 w-4" /> Word
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => exportActionTrackerToXLSX(actionItems, week, year, undefined, meetingDate)}
        className="gap-2 border-emerald-200 text-emerald-700"
      >
        <FileSpreadsheet className="h-4 w-4" /> XLSX
      </Button>
    </div>
  )
}
