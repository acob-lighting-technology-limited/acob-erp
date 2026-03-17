"use client"

import { Fragment } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/ui/patterns"
import { cn } from "@/lib/utils"
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  FileText,
  File as FileIcon,
  Presentation,
  Edit2,
  Trash2,
  MoreVertical,
  FileSpreadsheet,
} from "lucide-react"
import {
  exportToPDF,
  exportToDocx,
  exportToPPTX,
  exportToXLSX,
  autoNumberLines,
  type WeeklyReport,
} from "@/lib/export-utils"
import { format } from "date-fns"

interface ReportTableProps {
  reports: WeeklyReport[]
  loading: boolean
  expandedRows: Set<string>
  onToggleRow: (id: string) => void
  isFilteredWeekLocked: boolean
  currentUserDepartment: string | null | undefined
  onEdit: (report: WeeklyReport) => void
  onDelete: (id: string) => void
  onOpenPptxDialog: (report: WeeklyReport) => void
}

export function ReportTable({
  reports,
  loading,
  expandedRows,
  onToggleRow,
  isFilteredWeekLocked,
  currentUserDepartment,
  onEdit,
  onDelete,
  onOpenPptxDialog,
}: ReportTableProps) {
  return (
    <div className="bg-background dark:bg-card overflow-hidden rounded-lg border shadow-sm">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="text-muted-foreground w-[40px]"></TableHead>
            <TableHead className="text-foreground font-bold">Department</TableHead>
            <TableHead className="text-foreground font-bold">Submitted By</TableHead>
            <TableHead className="text-foreground font-bold">Week</TableHead>
            <TableHead className="text-foreground font-bold">Date</TableHead>
            <TableHead className="text-foreground text-right font-bold">Export</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center">
                <div className="text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading reports...
                </div>
              </TableCell>
            </TableRow>
          ) : reports.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-32">
                <EmptyState
                  title="No reports found for the selected criteria"
                  description="Try adjusting the week, year, department, or search filter."
                  icon={FileSpreadsheet}
                  className="border-0"
                />
              </TableCell>
            </TableRow>
          ) : (
            reports.map((report) => {
              const isMyDept = currentUserDepartment && report.department && currentUserDepartment === report.department
              const hasManageRights = isMyDept
              const p = Array.isArray(report.profiles) ? report.profiles[0] : report.profiles
              const submittedBy = p ? `${p.first_name} ${p.last_name}` : "Unknown"

              return (
                <Fragment key={report.id}>
                  <TableRow
                    className={cn(
                      "hover:bg-muted/50 cursor-pointer transition-colors",
                      expandedRows.has(report.id) && "bg-muted/30"
                    )}
                    onClick={() => onToggleRow(report.id)}
                  >
                    <TableCell>
                      {expandedRows.has(report.id) ? (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      )}
                    </TableCell>
                    <TableCell className="text-foreground font-bold">{report.department}</TableCell>
                    <TableCell className="text-muted-foreground">{submittedBy}</TableCell>
                    <TableCell className="text-foreground font-medium">
                      W{report.week_number}, {report.year}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {report.created_at ? format(new Date(report.created_at), "MMM dd, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <div className="bg-background flex items-center gap-1 rounded-md border p-0.5 shadow-sm">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-600 hover:text-red-700"
                            onClick={() => exportToPDF(report)}
                            title="PDF"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-indigo-600 hover:text-indigo-700"
                            onClick={() => exportToDocx(report)}
                            title="Word"
                          >
                            <FileIcon className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-amber-600 hover:text-amber-700"
                            onClick={() => onOpenPptxDialog(report)}
                            title="PPTX"
                          >
                            <Presentation className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                            onClick={() => exportToXLSX(report)}
                            title="XLSX"
                          >
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {hasManageRights && !isFilteredWeekLocked && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => onEdit(report)}>
                                <Edit2 className="h-4 w-4" /> Edit Report
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer gap-2 text-red-600"
                                onClick={() => onDelete(report.id)}
                              >
                                <Trash2 className="h-4 w-4" /> Delete Report
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedRows.has(report.id) && (
                    <TableRow className="bg-muted/20 hover:bg-muted/20 border-t-0">
                      <TableCell colSpan={6} className="p-0">
                        <div className="animate-in slide-in-from-top-2 grid grid-cols-1 gap-8 p-6 duration-200 md:grid-cols-3">
                          <div className="space-y-3">
                            <h4 className="text-primary flex items-center gap-2 text-[10px] font-black tracking-widest uppercase">
                              <div className="bg-primary h-1 w-1 rounded-full" />
                              Work Done
                            </h4>
                            <div className="text-foreground/80 border-primary/20 space-y-1.5 border-l-2 pl-3 text-sm font-medium">
                              {autoNumberLines(report.work_done)
                                .split("\n")
                                .map((line, i) => (
                                  <div key={i}>{line}</div>
                                ))}
                            </div>
                          </div>
                          <div className="space-y-3">
                            <h4 className="flex items-center gap-2 text-[10px] font-black tracking-widest text-indigo-500 uppercase">
                              <div className="h-1 w-1 rounded-full bg-indigo-500" />
                              Tasks for New Week
                            </h4>
                            <div className="text-foreground/80 space-y-1.5 border-l-2 border-indigo-100 pl-3 text-sm font-medium dark:border-indigo-900/30">
                              {autoNumberLines(report.tasks_new_week)
                                .split("\n")
                                .map((line, i) => (
                                  <div key={i}>{line}</div>
                                ))}
                            </div>
                          </div>
                          <div className="space-y-3">
                            <h4 className="flex items-center gap-2 text-[10px] font-black tracking-widest text-orange-500 uppercase">
                              <div className="h-1 w-1 rounded-full bg-orange-500" />
                              Challenges
                            </h4>
                            <div className="text-foreground/80 space-y-1.5 border-l-2 border-orange-100 pl-3 text-sm font-medium dark:border-orange-900/30">
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
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
