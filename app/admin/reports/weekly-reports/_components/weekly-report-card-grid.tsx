"use client"

import Link from "next/link"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  MoreVertical,
  Presentation,
  ExternalLink,
  Edit2,
  Trash2,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { autoNumberLines, exportToDocx, exportToPDF, exportToXLSX, type WeeklyReport } from "@/lib/export-utils"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface TrackerStatus {
  id: string
  department: string
  status: string
}

interface WeeklyReportCardGridProps {
  reports: WeeklyReport[]
  meetingDate: string
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

  if (deptActions.every((a) => a.status === "completed")) {
    return { label: "Finished", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" }
  }

  if (deptActions.some((a) => a.status === "in_progress" || a.status === "completed")) {
    return { label: "Started", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" }
  }

  if (deptActions.some((a) => a.status === "not_started")) {
    return { label: "Not Started", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" }
  }

  return { label: "Pending", color: "bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400" }
}

export function WeeklyReportCardGrid({
  reports,
  meetingDate,
  trackingData,
  isFilteredWeekLocked,
  canMutateReport,
  onEdit,
  onDelete,
  onExportPptx,
}: WeeklyReportCardGridProps) {
  if (reports.length === 0) {
    return (
      <Card className="border-2">
        <CardContent className="p-12 text-center">
          <FileSpreadsheet className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
          <h3 className="text-foreground mb-2 text-xl font-semibold">No Weekly Reports Found</h3>
          <p className="text-muted-foreground">No records match the current search and filters.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {reports.map((report) => {
        const trackerStatus = getActionTrackerStatus(report.department, trackingData)
        const submitterProfile = Array.isArray(report.profiles) ? report.profiles[0] : report.profiles
        const submitterName = submitterProfile ? `${submitterProfile.first_name} ${submitterProfile.last_name}` : "Unknown"
        const formattedMeetingDate = (() => {
          const date = new Date(`${meetingDate}T00:00:00`)
          if (Number.isNaN(date.getTime())) return "-"
          return format(date, "MMM dd, yyyy")
        })()

        return (
          <Card key={report.id} className="border-2 shadow-sm">
            <CardHeader className="bg-muted/50 border-b">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold">{report.department}</CardTitle>
                  <p className="text-muted-foreground text-sm">
                    W{report.week_number}, {report.year}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn("px-2.5 py-1 text-[10px] font-bold uppercase", trackerStatus.color)}>
                    {trackerStatus.label}
                  </Badge>
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
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground text-xs font-semibold uppercase">Meeting Date</p>
                  <p className="text-foreground font-medium">{formattedMeetingDate}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-semibold uppercase">Submitted By</p>
                  <p className="text-foreground font-medium">{submitterName}</p>
                </div>
                <div className="sm:col-span-2">
                  <Link
                    href={`/admin/reports/general-meeting/action-tracker?week=${report.week_number}&year=${report.year}&dept=${report.department}`}
                    className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
                  >
                    View action tracker
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              {[
                { label: "Work Done", value: report.work_done },
                { label: "Tasks for New Week", value: report.tasks_new_week },
                { label: "Challenges", value: report.challenges },
              ].map((section) => (
                <div key={section.label} className="space-y-2">
                  <p className="text-muted-foreground text-xs font-semibold uppercase">{section.label}</p>
                  <div className="bg-muted/30 rounded-lg border p-3 text-sm">
                    {autoNumberLines(section.value)
                      .split("\n")
                      .map((line, index) => (
                        <div key={`${section.label}-${index}`}>{line}</div>
                      ))}
                  </div>
                </div>
              ))}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => exportToPDF(report, meetingDate)}
                >
                  <FileText className="h-4 w-4" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                  onClick={() => exportToDocx(report, meetingDate)}
                >
                  <FileIcon className="h-4 w-4" />
                  Word
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                  onClick={() => onExportPptx(report)}
                >
                  <Presentation className="h-4 w-4" />
                  PPTX
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                  onClick={() => exportToXLSX(report, meetingDate)}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  XLSX
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
