"use client"

import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { getCurrentOfficeWeek } from "@/lib/meeting-week"
import { toast } from "sonner"
import { fetchWeeklyReportLockState } from "@/lib/weekly-report-lock"
import { FileBarChart } from "lucide-react"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { WeeklyReportDialog } from "@/components/dashboard/reports/weekly-report-dialog"
import { WeeklyReportFilters } from "./_components/weekly-report-filters"
import {
  exportAllToPPTX,
  sortReportsByDepartment,
  type WeeklyPptxMode,
  type WeeklyPptxTheme,
  type WeeklyReport,
} from "@/lib/export-utils"
import { QUERY_KEYS } from "@/lib/query-keys"
import { ReportTable } from "./_components/report-table"
import { PptxModeDialog } from "./_components/pptx-mode-dialog"
import { ReportExportActions } from "./_components/report-export-actions"

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedReportParams, setSelectedReportParams] = useState<any>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [pptxModeDialogOpen, setPptxModeDialogOpen] = useState(false)
  const [pendingPptxExport, setPendingPptxExport] = useState<
    { kind: "single"; report: WeeklyReport } | { kind: "all" } | null
  >(null)
  const [isFilteredWeekLocked, setIsFilteredWeekLocked] = useState(false)
  const [meetingDate, setMeetingDate] = useState<string | undefined>(undefined)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const supabase = createClient()
  const queryClient = useQueryClient()

  const { data: profileData } = useQuery({
    queryKey: ["portal-weekly-reports-profile"],
    queryFn: () => fetchProfileAndDepts(supabase),
  })

  const profile = profileData?.profile ?? null
  const allDepartments = profileData?.allDepartments ?? []

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

  useEffect(() => {
    const loadFilteredWeekLock = async () => {
      const state = await fetchWeeklyReportLockState(supabase, weekFilter, yearFilter)
      setIsFilteredWeekLocked(state.isLocked)
      setMeetingDate(state.meetingDate || undefined)
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
    try {
      const { error } = await supabase.from("weekly_reports").delete().eq("id", id)
      if (error) throw error
      toast.success("Report deleted")
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.weeklyReports({ week: weekFilter, year: yearFilter, dept: deptFilter }),
      })
    } catch {
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
      await exportAllToPPTX(filteredReports, weekFilter, yearFilter, mode, theme, meetingDate)
    } else {
      const { exportToPPTX } = await import("@/lib/export-utils")
      await exportToPPTX(pendingPptxExport.report, mode, theme, meetingDate)
    }
    setPptxModeDialogOpen(false)
    setPendingPptxExport(null)
  }

  const isLead =
    Boolean(profile?.is_department_lead) || ["admin", "super_admin", "developer"].includes(profile?.role || "")

  return (
    <AdminTablePage
      title="Weekly Departmental Reports"
      description="Browse weekly updates and progress from all departments"
      icon={FileBarChart}
      backLinkHref="/dashboard/reports"
      backLinkLabel="Back to Reports"
      actions={
        <ReportExportActions
          filteredReports={filteredReports}
          weekFilter={weekFilter}
          yearFilter={yearFilter}
          meetingDate={meetingDate}
          isLead={isLead}
          onOpenPptxDialog={openAllPptxModeDialog}
          onSubmitNew={() => {
            setSelectedReportParams({ week: weekFilter, year: yearFilter, dept: profile?.department })
            setIsDialogOpen(true)
          }}
        />
      }
      filters={
        <WeeklyReportFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          weekFilter={weekFilter}
          onWeekChange={setWeekFilter}
          yearFilter={yearFilter}
          onYearChange={setYearFilter}
          deptFilter={deptFilter}
          onDeptChange={setDeptFilter}
          allDepartments={allDepartments}
          isDepartmentLead={Boolean(profile?.is_department_lead)}
          loading={loading}
          onRefresh={() => refetchReports()}
        />
      }
    >
      <ReportTable
        reports={filteredReports}
        loading={loading}
        expandedRows={expandedRows}
        onToggleRow={toggleRow}
        meetingDate={meetingDate}
        isFilteredWeekLocked={isFilteredWeekLocked}
        currentUserDepartment={profile?.department}
        onEdit={(report) => {
          setSelectedReportParams({
            week: report.week_number,
            year: report.year,
            dept: report.department,
          })
          setIsDialogOpen(true)
        }}
        onDelete={(id) => setPendingDeleteId(id)}
        onOpenPptxDialog={openSinglePptxModeDialog}
      />

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

      <AlertDialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDeleteId) handleDelete(pendingDeleteId)
                setPendingDeleteId(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PptxModeDialog
        isOpen={pptxModeDialogOpen}
        onOpenChange={(open) => {
          setPptxModeDialogOpen(open)
          if (!open) setPendingPptxExport(null)
        }}
        onExport={runPptxExport}
      />
    </AdminTablePage>
  )
}
