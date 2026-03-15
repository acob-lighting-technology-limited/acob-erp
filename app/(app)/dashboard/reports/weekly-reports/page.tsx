"use client"

import { useState, useEffect, Fragment } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { getCurrentOfficeWeek } from "@/lib/meeting-week"
import { toast } from "sonner"
import { fetchWeeklyReportLockState } from "@/lib/weekly-report-lock"
import {
  FileBarChart,
  FileSearch,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  FileText,
  File as FileIcon,
  Presentation,
  Edit2,
  Trash2,
  MoreVertical,
  CheckCircle2,
  Target,
  AlertTriangle,
  Building2,
  FileSpreadsheet,
} from "lucide-react"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { WeeklyReportDialog } from "@/components/dashboard/reports/weekly-report-dialog"
import { EmptyState, FormFieldGroup } from "@/components/ui/patterns"
import {
  exportToPDF,
  exportToDocx,
  exportToPPTX,
  exportAllToPDF,
  exportAllToDocx,
  exportAllToPPTX,
  exportToXLSX,
  exportAllToXLSX,
  autoNumberLines,
  sortReportsByDepartment,
  type WeeklyPptxMode,
  type WeeklyPptxTheme,
  type WeeklyReport,
} from "@/lib/export-utils"
import { format } from "date-fns"
import { QUERY_KEYS } from "@/lib/query-keys"
import { TableSkeleton } from "@/components/ui/query-states"

import { logger } from "@/lib/logger"

const log = logger("dashboard-reports-weekly-reports")

interface UserProfile {
  id: string
  department: string | null
  role: string
  is_department_lead: boolean
}

async function fetchProfileAndDepts(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { profile: null, allDepartments: [] }

  const { data: p } = await supabase
    .from("profiles")
    .select("id, department, role, is_department_lead")
    .eq("id", user.id)
    .single()

  const { data: depts } = await supabase.from("profiles").select("department").not("department", "is", null)
  const uniqueDepts = Array.from(new Set(depts?.map((d: any) => d.department).filter(Boolean))) as string[]

  return { profile: p as UserProfile | null, allDepartments: uniqueDepts.sort() }
}

async function fetchReports(
  supabase: ReturnType<typeof createClient>,
  profile: UserProfile | null,
  weekFilter: number,
  yearFilter: number,
  deptFilter: string
): Promise<WeeklyReport[]> {
  if (!profile) return []

  let query = supabase
    .from("weekly_reports")
    .select("*, profiles:user_id ( first_name, last_name )")
    .eq("status", "submitted")
    .eq("week_number", weekFilter)
    .eq("year", yearFilter)
    .order("department", { ascending: true })

  const effectiveDept = profile?.is_department_lead ? profile.department || "all" : deptFilter
  if (effectiveDept !== "all") {
    query = query.eq("department", effectiveDept)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return sortReportsByDepartment(data || [])
}

export default function WeeklyReportsPortal() {
  const currentOfficeWeek = getCurrentOfficeWeek()
  const [searchQuery, setSearchQuery] = useState("")
  const [deptFilter, setDeptFilter] = useState("all")
  const [yearFilter, setYearFilter] = useState(currentOfficeWeek.year)
  const [weekFilter, setWeekFilter] = useState(currentOfficeWeek.week)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedReportParams, setSelectedReportParams] = useState<any>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [pptxModeDialogOpen, setPptxModeDialogOpen] = useState(false)
  const [pendingPptxExport, setPendingPptxExport] = useState<
    { kind: "single"; report: WeeklyReport } | { kind: "all" } | null
  >(null)
  const [isFilteredWeekLocked, setIsFilteredWeekLocked] = useState(false)

  const supabase = createClient()
  const queryClient = useQueryClient()

  const { data: profileData } = useQuery({
    queryKey: ["portal-weekly-reports-profile"],
    queryFn: () => fetchProfileAndDepts(supabase),
  })

  const profile = profileData?.profile ?? null
  const allDepartments = profileData?.allDepartments ?? []

  // Set dept filter for dept leads on initial load
  useEffect(() => {
    if (profile?.is_department_lead && profile.department) {
      setDeptFilter(profile.department || "all")
    }
  }, [profile?.id])

  const {
    data: reports = [],
    isLoading: loading,
    refetch: refetchReports,
  } = useQuery({
    queryKey: QUERY_KEYS.weeklyReports({ week: weekFilter, year: yearFilter, dept: deptFilter }),
    queryFn: () => fetchReports(supabase, profile, weekFilter, yearFilter, deptFilter),
    enabled: !!profile,
  })

  // Check lock state for the filtered week
  useEffect(() => {
    const loadFilteredWeekLock = async () => {
      const state = await fetchWeeklyReportLockState(supabase, weekFilter, yearFilter)
      setIsFilteredWeekLocked(state.isLocked)
    }
    loadFilteredWeekLock()
  }, [weekFilter, yearFilter])

  const handleDelete = async (id: string) => {
    const target = reports.find((r) => r.id === id)
    if (target) {
      const lock = await fetchWeeklyReportLockState(supabase, target.week_number, target.year)
      if (lock.isLocked) {
        toast.error("This report week is locked. Delete is no longer allowed.")
        return
      }
    }
    if (!confirm("Are you sure? Delete is permanent.")) return
    try {
      const { error } = await supabase.from("weekly_reports").delete().eq("id", id)
      if (error) throw error
      toast.success("Report deleted")
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.weeklyReports({ week: weekFilter, year: yearFilter, dept: deptFilter }),
      })
    } catch (error) {
      toast.error("Failed to delete report")
    }
  }

  const toggleRow = (id: string) => {
    const next = new Set(expandedRows)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedRows(next)
  }

  const filteredReports = reports.filter(
    (r) =>
      r.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.work_done?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const openAllPptxModeDialog = () => {
    setPendingPptxExport({ kind: "all" })
    setPptxModeDialogOpen(true)
  }

  const openSinglePptxModeDialog = (report: WeeklyReport) => {
    setPendingPptxExport({ kind: "single", report })
    setPptxModeDialogOpen(true)
  }

  const runPptxExport = async (mode: WeeklyPptxMode, theme: WeeklyPptxTheme = "light") => {
    if (!pendingPptxExport) return
    if (pendingPptxExport.kind === "all") {
      await exportAllToPPTX(filteredReports, weekFilter, yearFilter, mode, theme)
    } else {
      await exportToPPTX(pendingPptxExport.report, mode, theme)
    }
    setPptxModeDialogOpen(false)
    setPendingPptxExport(null)
  }

  const isLead =
    Boolean(profile?.is_department_lead) || ["admin", "super_admin", "developer"].includes(profile?.role || "")
  const isAdmin = ["developer", "admin", "super_admin"].includes(profile?.role || "")

  return (
    <AdminTablePage
      title="Weekly Departmental Reports"
      description="Browse weekly updates and progress from all departments"
      icon={FileBarChart}
      backLinkHref="/dashboard/reports"
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
                variant="outline"
                onClick={() => exportAllToXLSX(filteredReports, weekFilter, yearFilter)}
                className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-900/30 dark:hover:bg-emerald-950/20"
              >
                <FileSpreadsheet className="h-4 w-4" /> <span className="hidden sm:inline">XLSX</span>
              </Button>
            </>
          )}
          {isLead && (
            <Button
              className="gap-2 shadow-sm"
              onClick={() => {
                setSelectedReportParams({ week: weekFilter, year: yearFilter, dept: profile?.department })
                setIsDialogOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              Submit New Report
            </Button>
          )}
        </div>
      }
      filters={
        <div className="mb-6 flex flex-col items-end justify-between gap-4 md:flex-row">
          <div className="w-full max-w-md flex-1">
            <FormFieldGroup label="Search Content" className="space-y-1">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </FormFieldGroup>
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
              <Select value={deptFilter} onValueChange={setDeptFilter} disabled={profile?.is_department_lead}>
                <SelectTrigger>
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Every Department</SelectItem>
                  {allDepartments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetchReports()}
              disabled={loading}
              className="shrink-0"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
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
            ) : filteredReports.length === 0 ? (
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
              filteredReports.map((report) => {
                const isMyDept = profile?.department && report.department && profile.department === report.department
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
                              onClick={() => openSinglePptxModeDialog(report)}
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
                                <DropdownMenuItem
                                  className="cursor-pointer gap-2"
                                  onClick={() => {
                                    setSelectedReportParams({
                                      week: report.week_number,
                                      year: report.year,
                                      dept: report.department,
                                    })
                                    setIsDialogOpen(true)
                                  }}
                                >
                                  <Edit2 className="h-4 w-4" /> Edit Report
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="cursor-pointer gap-2 text-red-600"
                                  onClick={() => handleDelete(report.id)}
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

      <WeeklyReportDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false)
          setSelectedReportParams(null)
        }}
        onSuccess={() =>
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.weeklyReports({ week: weekFilter, year: yearFilter, dept: deptFilter }),
          })
        }
        initialData={selectedReportParams}
      />

      <Dialog
        open={pptxModeDialogOpen}
        onOpenChange={(open) => {
          setPptxModeDialogOpen(open)
          if (!open) setPendingPptxExport(null)
        }}
      >
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select PPTX Mode</DialogTitle>
            <DialogDescription>Choose layout mode and theme for the PowerPoint export.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Button variant="outline" onClick={() => runPptxExport("compact", "light")} className="justify-start">
              Compact (Light)
            </Button>
            <Button variant="outline" onClick={() => runPptxExport("full", "light")} className="justify-start">
              Full (Light)
            </Button>
            <Button variant="outline" onClick={() => runPptxExport("compact", "dark")} className="justify-start">
              Compact (Dark)
            </Button>
            <Button onClick={() => runPptxExport("full", "dark")} className="justify-start">
              Full (Dark)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminTablePage>
  )
}
