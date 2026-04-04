"use client"

import { Fragment } from "react"
import { TableCell, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  ChevronDown,
  ChevronRight,
  MoreVertical,
  FileText,
  File as FileIcon,
  Presentation,
  Edit2,
  Trash2,
  ExternalLink,
  FileSpreadsheet,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { toast } from "sonner"
import { autoNumberLines, exportToPDF, exportToDocx, exportToXLSX, type WeeklyReport } from "@/lib/export-utils"

interface TrackerStatus {
  id: string
  department: string
  status: string
}

interface WeeklyReportTableRowProps {
  report: WeeklyReport
  meetingDate: string
  isExpanded: boolean
  onToggle: () => void
  trackingData: TrackerStatus[]
  isFilteredWeekLocked: boolean
  canMutateReport: (report: WeeklyReport) => boolean
  onEdit: (report: WeeklyReport) => void
  onDelete: (id: string) => void
  onExportPptx: (report: WeeklyReport) => void
}

function getActionTrackerStatus(department: string, trackingData: TrackerStatus[]) {
  const deptActions = trackingData.filter((a) => a.department === department)
  if (deptActions.length === 0)
    return { label: "Pending", color: "bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400" }

  const allCompleted = deptActions.every((a) => a.status === "completed")
  if (allCompleted)
    return { label: "Finished", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" }

  const anyInProgress = deptActions.some((a) => a.status === "in_progress")
  const anyCompleted = deptActions.some((a) => a.status === "completed")
  if (anyInProgress || anyCompleted)
    return { label: "Started", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" }

  const anyNotStarted = deptActions.some((a) => a.status === "not_started")
  if (anyNotStarted)
    return { label: "Not Started", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" }

  return { label: "Pending", color: "bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400" }
}

export function WeeklyReportTableRow({
  report,
  meetingDate,
  isExpanded,
  onToggle,
  trackingData,
  isFilteredWeekLocked,
  canMutateReport,
  onEdit,
  onDelete,
  onExportPptx,
}: WeeklyReportTableRowProps) {
  const trackerStatus = getActionTrackerStatus(report.department, trackingData)
  const submitterProfile = Array.isArray(report.profiles) ? report.profiles[0] : report.profiles
  const submitterName = submitterProfile ? `${submitterProfile.first_name} ${submitterProfile.last_name}` : "Unknown"
  const formattedMeetingDate = (() => {
    const date = new Date(`${meetingDate}T00:00:00`)
    if (Number.isNaN(date.getTime())) return "-"
    return format(date, "MMM dd, yyyy")
  })()

  return (
    <Fragment>
      <TableRow
        className={cn("hover:bg-muted/50 cursor-pointer transition-colors", isExpanded && "bg-muted/30")}
        onClick={onToggle}
      >
        <TableCell>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          )}
        </TableCell>
        <TableCell className="text-foreground font-bold">{report.department}</TableCell>
        <TableCell className="text-muted-foreground text-sm">{formattedMeetingDate}</TableCell>
        <TableCell className="text-foreground font-medium">W{report.week_number}</TableCell>
        <TableCell className="text-muted-foreground">{submitterName}</TableCell>
        <TableCell className="text-muted-foreground text-sm">
          {format(new Date(report.created_at), "MMM dd, yyyy")}
        </TableCell>
        <TableCell className="text-center">
          <Link
            href={`/admin/reports/general-meeting/action-tracker?week=${report.week_number}&year=${report.year}&dept=${report.department}`}
            className="group flex flex-col items-center gap-1 transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <Badge
              variant="secondary"
              className={cn(
                "px-2.5 py-1 text-[10px] font-bold uppercase transition-all duration-200",
                "group-hover:ring-primary/20 cursor-pointer ring-1 ring-transparent group-hover:scale-110 group-hover:shadow-md",
                trackerStatus.color
              )}
            >
              <div className="flex items-center gap-1.5">
                {trackerStatus.label}
                <ExternalLink className="h-2.5 w-2.5 opacity-50 transition-opacity group-hover:opacity-100" />
              </div>
            </Badge>
          </Link>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <div className="bg-background flex items-center gap-1 rounded-md border p-0.5 shadow-sm">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-600 hover:text-red-700"
                onClick={() => exportToPDF(report, meetingDate)}
                title="PDF"
              >
                <FileIcon className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-indigo-600 hover:text-indigo-700"
                onClick={() => exportToDocx(report, meetingDate)}
                title="Word"
              >
                <FileText className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-amber-600 hover:text-amber-700"
                onClick={() => onExportPptx(report)}
                title="Deck"
              >
                <Presentation className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                onClick={() => exportToXLSX(report, meetingDate)}
                title="XLSX"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
              </Button>
            </div>
            {!isFilteredWeekLocked && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={!canMutateReport(report)}
                    onClick={() => {
                      if (!canMutateReport(report)) {
                        toast.error("You can only edit your own reports")
                        return
                      }
                      onEdit(report)
                    }}
                  >
                    <Edit2 className="mr-2 h-4 w-4" /> Edit Report
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={!canMutateReport(report)}
                    className="text-red-600 focus:bg-red-50 focus:text-red-600"
                    onClick={() => onDelete(report.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Purge Record
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow className="bg-muted/20 hover:bg-muted/20 border-t-0">
          <TableCell colSpan={8} className="p-0">
            <div className="animate-in slide-in-from-top-2 grid grid-cols-1 gap-8 p-6 duration-200 md:grid-cols-3">
              <div className="space-y-3">
                <h4 className="flex items-center gap-2 text-[10px] font-black tracking-widest text-blue-600 uppercase">
                  <div className="h-1 w-1 rounded-full bg-blue-600" />
                  Work Done
                </h4>
                <div className="text-foreground/80 space-y-1.5 border-l-2 border-blue-100 pl-3 text-sm font-medium dark:border-blue-900/30">
                  {autoNumberLines(report.work_done)
                    .split("\n")
                    .map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="flex items-center gap-2 text-[10px] font-black tracking-widest text-emerald-600 uppercase">
                  <div className="h-1 w-1 rounded-full bg-emerald-600" />
                  Tasks for New Week
                </h4>
                <div className="text-foreground/80 space-y-1.5 border-l-2 border-emerald-100 pl-3 text-sm font-medium dark:border-emerald-900/30">
                  {autoNumberLines(report.tasks_new_week)
                    .split("\n")
                    .map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="flex items-center gap-2 text-[10px] font-black tracking-widest text-rose-600 uppercase">
                  <div className="h-1 w-1 rounded-full bg-rose-600" />
                  Challenges
                </h4>
                <div className="text-foreground/80 space-y-1.5 border-l-2 border-rose-100 pl-3 text-sm font-medium dark:border-rose-900/30">
                  {autoNumberLines(report.challenges)
                    .split("\n")
                    .map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  )
}
