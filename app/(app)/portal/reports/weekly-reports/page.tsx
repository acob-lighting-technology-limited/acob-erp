"use client"

import { useState, useEffect, Fragment } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createClient } from "@/lib/supabase/client"
import { getCurrentISOWeek, cn } from "@/lib/utils"
import { toast } from "sonner"
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
} from "lucide-react"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { WeeklyReportDialog } from "@/components/portal/reports/weekly-report-dialog"
import { exportToPDF, exportToDocx, exportToPPTX, autoNumberLines, type WeeklyReport } from "@/lib/export-utils"
import { format } from "date-fns"

export default function WeeklyReportsPortal() {
  const [reports, setReports] = useState<WeeklyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [deptFilter, setDeptFilter] = useState("all")
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear())
  const [weekFilter, setWeekFilter] = useState(getCurrentISOWeek())
  const [allDepartments, setAllDepartments] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedReportParams, setSelectedReportParams] = useState<any>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const supabase = createClient()

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (profile) loadReports()
  }, [profile, weekFilter, yearFilter, deptFilter])

  async function fetchInitialData() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data: p } = await supabase.from("profiles").select("id, department, role").eq("id", user.id).single()
        setProfile(p)

        const { data: depts } = await supabase.from("profiles").select("department").not("department", "is", null)
        const uniqueDepts = Array.from(new Set(depts?.map((d) => d.department).filter(Boolean))) as string[]
        setAllDepartments(uniqueDepts.sort())

        if (p?.role === "lead") {
          setDeptFilter(p.department || "all")
        }
      }
    } catch (error) {
      console.error("Error fetching initial data:", error)
    }
  }

  async function loadReports() {
    setLoading(true)
    try {
      let query = supabase
        .from("weekly_reports")
        .select("*, profiles:user_id ( first_name, last_name )")
        .eq("status", "submitted")
        .eq("week_number", weekFilter)
        .eq("year", yearFilter)
        .order("department", { ascending: true })

      const effectiveDept = profile?.role === "lead" ? profile.department || "all" : deptFilter
      if (effectiveDept !== "all") {
        query = query.eq("department", effectiveDept)
      }

      const { data, error } = await query
      if (error) throw error
      setReports(data || [])
    } catch (error) {
      console.error("Error loading reports:", error)
      toast.error("Failed to load reports")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? Delete is permanent.")) return
    try {
      const { error } = await supabase.from("weekly_reports").delete().eq("id", id)
      if (error) throw error
      toast.success("Report deleted")
      loadReports()
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

  const isLead = profile?.role === "lead" || profile?.role === "admin" || profile?.role === "super_admin"
  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin"

  return (
    <AdminTablePage
      title="Weekly Departmental Reports"
      description="Browse weekly updates and progress from all departments"
      icon={FileBarChart}
      backLinkHref="/portal/reports"
      backLinkLabel="Back to Reports"
      actions={
        isLead ? (
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
        ) : null
      }
      filters={
        <div className="mb-6 flex flex-col items-end justify-between gap-4 md:flex-row">
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
              <Select value={deptFilter} onValueChange={setDeptFilter} disabled={profile?.role === "lead"}>
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
            <Button variant="outline" size="icon" onClick={loadReports} disabled={loading} className="shrink-0">
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
                <TableCell colSpan={6} className="text-muted-foreground h-32 text-center font-medium">
                  No reports found for the selected criteria.
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
                              onClick={() => exportToPPTX(report)}
                              title="PPTX"
                            >
                              <Presentation className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          {hasManageRights && (
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
        onSuccess={() => loadReports()}
        initialData={selectedReportParams}
      />
    </AdminTablePage>
  )
}
