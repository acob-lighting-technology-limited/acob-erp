"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { getCurrentOfficeWeek } from "@/lib/meeting-week"
import { toast } from "sonner"
import { fetchWeeklyReportLockState, getDefaultMeetingDateIso } from "@/lib/weekly-report-lock"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ChevronDown,
  ChevronRight,
  MoreVertical,
  FileText,
  File as FileIcon,
  Presentation,
  Plus,
  RefreshCw,
  Clock,
  ExternalLink,
  User,
  CalendarDays,
  Edit2,
  Trash2,
  FileBarChart,
  Loader2,
  Search,
} from "lucide-react"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import {
  exportToPDF,
  exportToDocx,
  exportToPPTX,
  exportAllToPDF,
  exportAllToDocx,
  exportAllToPPTX,
  autoNumberLines,
  sortReportsByDepartment,
  type WeeklyPptxMode,
  type WeeklyReport,
} from "@/lib/export-utils"
import { WeeklyReportAdminDialog } from "@/components/admin/reports/weekly-report-dialog"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Label } from "@/components/ui/label"
import { Fragment } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface TrackerStatus {
  id: string
  department: string
  status: string
}

interface WeeklyReportsContentProps {
  initialDepartments: string[]
  scopedDepartments?: string[]
  currentUser: {
    id: string
    role: string
    department: string | null
  }
}

export function WeeklyReportsContent({
  initialDepartments,
  scopedDepartments = [],
  currentUser,
}: WeeklyReportsContentProps) {
  const currentOfficeWeek = getCurrentOfficeWeek()
  const [reports, setReports] = useState<WeeklyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [weekFilter, setWeekFilter] = useState(currentOfficeWeek.week)
  const [yearFilter, setYearFilter] = useState(currentOfficeWeek.year)
  const [deptFilter, setDeptFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isAdminDialogOpen, setIsAdminDialogOpen] = useState(false)
  const [editingReport, setEditingReport] = useState<WeeklyReport | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [trackingData, setTrackingData] = useState<TrackerStatus[]>([])
  const [pptxModeDialogOpen, setPptxModeDialogOpen] = useState(false)
  const [pendingPptxExport, setPendingPptxExport] = useState<
    { kind: "single"; report: WeeklyReport } | { kind: "all" } | null
  >(null)
  const [meetingDateInput, setMeetingDateInput] = useState(
    getDefaultMeetingDateIso(currentOfficeWeek.week, currentOfficeWeek.year)
  )
  const [meetingGraceHours, setMeetingGraceHours] = useState(24)
  const [savingMeetingWindow, setSavingMeetingWindow] = useState(false)
  const [isFilteredWeekLocked, setIsFilteredWeekLocked] = useState(false)

  const supabase = createClient()
  const isLead = currentUser.role === "lead"
  const isAdminRole = currentUser.role === "admin" || currentUser.role === "super_admin"
  const canMutateReport = (report: WeeklyReport) => !isLead || report.user_id === currentUser.id

  const loadReports = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from("weekly_reports")
        .select(
          "id, department, week_number, year, work_done, tasks_new_week, challenges, status, user_id, created_at, profiles(first_name, last_name)"
        )
        .eq("status", "submitted")
        .eq("week_number", weekFilter)
        .eq("year", yearFilter)
        .order("department", { ascending: true })

      if (deptFilter !== "all") {
        query = query.eq("department", deptFilter)
      }
      if (scopedDepartments.length > 0) {
        query = query.in("department", scopedDepartments)
      }

      const { data, error } = await query
      if (error) throw error

      const sortedData = sortReportsByDepartment(data || [])
      setReports(sortedData)

      // ─── Fetch Action Items for Aggregate Status (SAME WEEK) ─────────────────
      const { data: actions, error: actionsError } = await supabase
        .from("action_items")
        .select("id, department, status")
        .eq("week_number", weekFilter)
        .eq("year", yearFilter)
        .in("department", scopedDepartments.length > 0 ? scopedDepartments : initialDepartments)

      if (!actionsError) {
        setTrackingData(actions || [])
      }
    } catch (error) {
      console.error("Error loading reports:", error)
      toast.error("Failed to load reports")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [weekFilter, yearFilter, deptFilter])

  useEffect(() => {
    const loadFilteredWeekLock = async () => {
      const state = await fetchWeeklyReportLockState(supabase, weekFilter, yearFilter)
      setIsFilteredWeekLocked(state.isLocked)
    }
    loadFilteredWeekLock()
  }, [weekFilter, yearFilter])

  useEffect(() => {
    const loadMeetingWindow = async () => {
      const state = await fetchWeeklyReportLockState(supabase, weekFilter, yearFilter)
      setMeetingDateInput(state.meetingDate || getDefaultMeetingDateIso(weekFilter, yearFilter))
      setMeetingGraceHours(state.graceHours || 24)
    }
    if (isAdminRole) {
      loadMeetingWindow()
    }
  }, [isAdminRole, weekFilter, yearFilter])

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  const handleDelete = async (id: string) => {
    const target = reports.find((r) => r.id === id)
    if (target && !canMutateReport(target)) {
      toast.error("You can only modify reports you created")
      return
    }
    if (target) {
      const lock = await fetchWeeklyReportLockState(supabase, target.week_number, target.year)
      if (lock.isLocked) {
        toast.error("This report week is locked. Delete is no longer allowed.")
        return
      }
    }
    if (!confirm("Are you sure? Admin delete is permanent.")) return
    try {
      const { error } = await supabase.from("weekly_reports").delete().eq("id", id)
      if (error) throw error
      toast.success("Report deleted")
      loadReports()
    } catch (error) {
      toast.error("Delete failed")
    }
  }

  const saveMeetingWindow = async () => {
    if (!meetingDateInput) {
      toast.error("Meeting date is required")
      return
    }
    if (meetingGraceHours < 0 || meetingGraceHours > 24) {
      toast.error("Grace hours must be between 0 and 24")
      return
    }

    setSavingMeetingWindow(true)
    try {
      const { error } = await supabase.from("weekly_report_meeting_windows").upsert(
        {
          week_number: weekFilter,
          year: yearFilter,
          meeting_date: meetingDateInput,
          grace_hours: meetingGraceHours,
          updated_by: currentUser.id,
          created_by: currentUser.id,
        },
        { onConflict: "week_number,year" }
      )
      if (error) throw error
      toast.success("Meeting window saved")
    } catch (error: any) {
      toast.error(error.message || "Failed to save meeting window")
    } finally {
      setSavingMeetingWindow(false)
    }
  }

  /** Calculates the overall status of the action tracker for a department. */
  const getActionTrackerStatus = (department: string) => {
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

    // Check for not_started specifically
    const anyNotStarted = deptActions.some((a) => a.status === "not_started")
    if (anyNotStarted)
      return { label: "Not Started", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" }

    // Default: all are pending
    return { label: "Pending", color: "bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400" }
  }

  /*
  const exportToPPT = async (report: WeeklyReport) => {
    try {
      const pptxgen = (await import("pptxgenjs")).default
      const pres = new pptxgen()
      pres.layout = "LAYOUT_WIDE"

      // Slide 1: Title
      const slide1 = pres.addSlide()
      slide1.background = { color: "#F8FAFC" }
      slide1.addText(`Weekly Departmental Report`, {
        x: 0,
        y: 1.5,
        w: "100%",
        h: 0.5,
        align: "center",
        fontSize: 36,
        color: "#1E293B",
        bold: true,
      })
      slide1.addText(`${report.department} | Week ${report.week_number}, ${report.year}`, {
        x: 0,
        y: 2.2,
        w: "100%",
        h: 0.4,
        align: "center",
        fontSize: 24,
        color: "#64748B",
      })

      // Slide 2: Work Done
      const slide2 = pres.addSlide()
      slide2.addText("Work Done", { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 24, bold: true, color: "#2563EB" })
      slide2.addText(report.work_done || "No data provided", {
        x: 0.5,
        y: 1.2,
        w: 9,
        h: 4,
        fontSize: 16,
        color: "#334155",
        valign: "top",
      })

      // Slide 3: Tasks for New Week
      const slide3 = pres.addSlide()
      slide3.addText("Tasks for New Week", { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 24, bold: true, color: "#10B981" })
      slide3.addText(report.tasks_new_week || "No data provided", {
        x: 0.5,
        y: 1.2,
        w: 9,
        h: 4,
        fontSize: 16,
        color: "#334155",
        valign: "top",
      })

      // Slide 4: Challenges
      const slide4 = pres.addSlide()
      slide4.addText("Challenges", { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 24, bold: true, color: "#EF4444" })
      slide4.addText(report.challenges || "No data provided", {
        x: 0.5,
        y: 1.2,
        w: 9,
        h: 4,
        fontSize: 16,
        color: "#334155",
        valign: "top",
      })

      await pres.writeFile({ fileName: `${report.department}_W${report.week_number}_Report.pptx` })
      toast.success("PowerPoint generated successfully")
    } catch (error) {
      console.error("PPT Error:", error)
      toast.error("Failed to generate PowerPoint")
    }
  }
  */

  const filteredReports = reports.filter(
    (r) =>
      r.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.work_done.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const openAllPptxModeDialog = () => {
    setPendingPptxExport({ kind: "all" })
    setPptxModeDialogOpen(true)
  }

  const openSinglePptxModeDialog = (report: WeeklyReport) => {
    setPendingPptxExport({ kind: "single", report })
    setPptxModeDialogOpen(true)
  }

  const runPptxExport = async (mode: WeeklyPptxMode) => {
    if (!pendingPptxExport) return
    if (pendingPptxExport.kind === "all") {
      await exportAllToPPTX(filteredReports, weekFilter, yearFilter, mode)
    } else {
      await exportToPPTX(pendingPptxExport.report, mode)
    }
    setPptxModeDialogOpen(false)
    setPendingPptxExport(null)
  }

  return (
    <AdminTablePage
      title="Weekly Reports"
      description="Review and export departmental reports"
      icon={FileBarChart}
      backLinkHref="/admin/reports"
      backLinkLabel="Back to Reports"
      actions={
        <div className="flex items-center gap-2">
          {filteredReports.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => exportAllToPDF(filteredReports, weekFilter, yearFilter)}
                className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/30 dark:hover:bg-red-950/20"
              >
                <FileText className="h-4 w-4" /> <span className="hidden sm:inline">PDF</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => exportAllToDocx(filteredReports, weekFilter, yearFilter)}
                className="gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-900/30 dark:hover:bg-blue-950/20"
              >
                <FileIcon className="h-4 w-4" /> <span className="hidden sm:inline">Word</span>
              </Button>
              <Button
                variant="outline"
                onClick={openAllPptxModeDialog}
                className="gap-2 border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700 dark:border-orange-900/30 dark:hover:bg-orange-950/20"
              >
                <Presentation className="h-4 w-4" /> <span className="hidden sm:inline">PPTX</span>
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
            onClick={() => {
              setEditingReport(null)
              setIsAdminDialogOpen(true)
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> Add Report
          </Button>
        </div>
      }
      filters={
        <div className="mb-6 space-y-3">
          <div className="flex flex-col items-end justify-between gap-4 md:flex-row">
            <div className="w-full max-w-md flex-1">
              <Label className="mb-1.5 block text-xs font-semibold">Search Content</Label>
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex w-full flex-wrap items-end gap-3 md:w-auto">
              <div className="w-24">
                <Label className="mb-1.5 block text-xs font-semibold">Week</Label>
                <Input
                  type="number"
                  value={weekFilter}
                  onChange={(e) => setWeekFilter(parseInt(e.target.value) || weekFilter)}
                />
              </div>
              <div className="w-28">
                <Label className="mb-1.5 block text-xs font-semibold">Year</Label>
                <Input
                  type="number"
                  value={yearFilter}
                  onChange={(e) => setYearFilter(parseInt(e.target.value) || yearFilter)}
                />
              </div>
              <div className="min-w-[12rem] flex-1 md:flex-none">
                <Label className="mb-1.5 block text-xs font-semibold">Department</Label>
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Every Department</SelectItem>
                    {initialDepartments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="icon" onClick={loadReports} disabled={loading} className="shrink-0">
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
            </div>
          </div>

          {isAdminRole && (
            <div className="bg-muted/30 rounded-lg border p-3">
              <p className="mb-2 text-xs font-semibold">Meeting Date Lock Window (selected week)</p>
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="w-full max-w-[220px]">
                  <Label className="mb-1.5 block text-xs font-semibold">Meeting Date</Label>
                  <Input type="date" value={meetingDateInput} onChange={(e) => setMeetingDateInput(e.target.value)} />
                </div>
                <div className="w-full max-w-[180px]">
                  <Label className="mb-1.5 block text-xs font-semibold">Grace Hours</Label>
                  <Input
                    type="number"
                    value={meetingGraceHours}
                    onChange={(e) => setMeetingGraceHours(parseInt(e.target.value) || 0)}
                    min={0}
                    max={24}
                  />
                </div>
                <Button onClick={saveMeetingWindow} disabled={savingMeetingWindow} className="gap-2">
                  {savingMeetingWindow && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Meeting Window
                </Button>
              </div>
              <p className="text-muted-foreground mt-2 text-[11px]">
                Use this when meeting shifts from Monday (e.g., public holiday to Tuesday).
              </p>
            </div>
          )}
        </div>
      }
    >
      <div className="bg-background dark:bg-card overflow-hidden rounded-lg border shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-muted-foreground w-[40px]"></TableHead>
              <TableHead className="text-foreground font-bold">Department</TableHead>
              <TableHead className="text-foreground font-bold">Submitted By</TableHead>
              <TableHead className="text-foreground font-bold">Week</TableHead>
              <TableHead className="text-foreground font-bold">Submission Date</TableHead>
              <TableHead className="text-foreground text-center font-bold">Action Tracker</TableHead>
              <TableHead className="text-foreground text-right font-bold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <div className="text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Auditing records...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredReports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground h-32 text-center font-medium">
                  No records found for the selected criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredReports.map((report) => (
                <Fragment key={report.id}>
                  <TableRow
                    className={cn(
                      "hover:bg-muted/50 cursor-pointer transition-colors",
                      expandedRows.has(report.id) && "bg-muted/30"
                    )}
                    onClick={() => toggleRow(report.id)}
                  >
                    <TableCell>
                      {expandedRows.has(report.id) ? (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      )}
                    </TableCell>
                    <TableCell className="text-foreground font-bold">{report.department}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {(() => {
                        const p = Array.isArray(report.profiles) ? report.profiles[0] : report.profiles
                        return p ? `${p.first_name} ${p.last_name}` : "Unknown"
                      })()}
                    </TableCell>
                    <TableCell className="text-foreground font-medium">
                      W{report.week_number}, {report.year}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(report.created_at), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell className="text-center">
                      <Link
                        href={`/admin/reports/action-tracker?week=${report.week_number}&year=${report.year}&dept=${report.department}`}
                        className="group flex flex-col items-center gap-1 transition-all"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(() => {
                          const status = getActionTrackerStatus(report.department)
                          return (
                            <Badge
                              variant="secondary"
                              className={cn(
                                "px-2.5 py-1 text-[10px] font-bold uppercase transition-all duration-200",
                                "group-hover:ring-primary/20 cursor-pointer ring-1 ring-transparent group-hover:scale-110 group-hover:shadow-md",
                                status.color
                              )}
                            >
                              <div className="flex items-center gap-1.5">
                                {status.label}
                                <ExternalLink className="h-2.5 w-2.5 opacity-50 transition-opacity group-hover:opacity-100" />
                              </div>
                            </Badge>
                          )
                        })()}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <div className="bg-background flex items-center gap-1 rounded-md border p-0.5 shadow-sm">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-600 hover:text-red-700"
                            onClick={() => exportToPDF(report)}
                            title="PDF"
                          >
                            <FileIcon className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-indigo-600 hover:text-indigo-700"
                            onClick={() => exportToDocx(report)}
                            title="Word"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-amber-600 hover:text-amber-700"
                            onClick={() => openSinglePptxModeDialog(report)}
                            title="Deck"
                          >
                            <Presentation className="h-3.5 w-3.5" />
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
                                  setEditingReport(report)
                                  setIsAdminDialogOpen(true)
                                }}
                              >
                                <Edit2 className="mr-2 h-4 w-4" /> Edit Report
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled={!canMutateReport(report)}
                                className="text-red-600 focus:bg-red-50 focus:text-red-600"
                                onClick={() => handleDelete(report.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Purge Record
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <WeeklyReportAdminDialog
        isOpen={isAdminDialogOpen}
        onClose={() => setIsAdminDialogOpen(false)}
        report={editingReport}
        onSuccess={loadReports}
        currentUser={currentUser}
      />

      <Dialog
        open={pptxModeDialogOpen}
        onOpenChange={(open) => {
          setPptxModeDialogOpen(open)
          if (!open) setPendingPptxExport(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select PPTX Mode</DialogTitle>
            <DialogDescription>
              Compact uses the previous pushed layout. Full uses the current expanded layout.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Button variant="outline" onClick={() => runPptxExport("compact")} className="justify-start">
              Compact (Previous)
            </Button>
            <Button onClick={() => runPptxExport("full")} className="justify-start">
              Full (Current)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminTablePage>
  )
}
