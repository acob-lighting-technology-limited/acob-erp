"use client"

import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { createClient } from "@/lib/supabase/client"
import { getCurrentOfficeWeek } from "@/lib/meeting-week"
import { toast } from "sonner"
import { fetchWeeklyReportLockState, getDefaultMeetingDateIso } from "@/lib/weekly-report-lock"

import { FileBarChart } from "lucide-react"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import {
  exportAllToPPTX,
  sortReportsByDepartment,
  type WeeklyPptxMode,
  type WeeklyPptxTheme,
  type WeeklyReport,
} from "@/lib/export-utils"
import { WeeklyReportAdminDialog } from "@/components/admin/reports/weekly-report-dialog"

import { WeeklyReportFiltersBar } from "./_components/weekly-report-filters-bar"
import { PptxModeDialog } from "./_components/pptx-mode-dialog"
import { DeleteReportDialog } from "./_components/delete-report-dialog"
import { WeeklyReportExportActions } from "./_components/weekly-report-export-actions"
import { WeeklyReportTable } from "./_components/weekly-report-table"

interface AdminWeeklyReportsData {
  reports: WeeklyReport[]
  trackingData: TrackerStatus[]
}

async function fetchAdminWeeklyReports(
  supabase: ReturnType<typeof createClient>,
  weekFilter: number,
  yearFilter: number,
  deptFilter: string,
  initialDepartments: string[]
): Promise<AdminWeeklyReportsData> {
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
  const { data, error } = await query
  if (error) throw new Error(error.message)

  const sortedData = sortReportsByDepartment(data || [])

  const { data: actions, error: actionsError } = await supabase
    .from("tasks")
    .select("id, department, status")
    .eq("category", "weekly_action")
    .eq("week_number", weekFilter)
    .eq("year", yearFilter)
    .in("department", initialDepartments)

  return {
    reports: sortedData,
    trackingData: actionsError ? [] : actions || [],
  }
}

async function fetchAdminWeeklyReportLockState(supabase: ReturnType<typeof createClient>, week: number, year: number) {
  return fetchWeeklyReportLockState(supabase, week, year)
}

interface TrackerStatus {
  id: string
  department: string
  status: string
}

interface WeeklyReportsContentProps {
  initialDepartments: string[]
  scopedDepartments?: string[]
  editableDepartments?: string[]
  currentUser: {
    id: string
    role: string
    department: string | null
    is_department_lead: boolean
    lead_departments?: string[]
    admin_domains?: string[] | null
  }
}

export function WeeklyReportsContent({
  initialDepartments,
  scopedDepartments = [],
  editableDepartments = [],
  currentUser,
}: WeeklyReportsContentProps) {
  const currentOfficeWeek = getCurrentOfficeWeek()
  const [weekFilter, setWeekFilter] = useState(currentOfficeWeek.week)
  const [yearFilter, setYearFilter] = useState(currentOfficeWeek.year)
  const [deptFilter, setDeptFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isAdminDialogOpen, setIsAdminDialogOpen] = useState(false)
  const [editingReport, setEditingReport] = useState<WeeklyReport | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [pptxModeDialogOpen, setPptxModeDialogOpen] = useState(false)
  const [pendingPptxExport, setPendingPptxExport] = useState<
    { kind: "single"; report: WeeklyReport } | { kind: "all" } | null
  >(null)
  const [meetingDateInput, setMeetingDateInput] = useState(
    getDefaultMeetingDateIso(currentOfficeWeek.week, currentOfficeWeek.year)
  )
  const [meetingGraceHours, setMeetingGraceHours] = useState(24)
  const [savingMeetingWindow, setSavingMeetingWindow] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const supabase = createClient()
  const queryClient = useQueryClient()
  const isAdminRole = ["developer", "admin", "super_admin"].includes(currentUser.role)
  const normalizedRole = (currentUser.role || "").trim().toLowerCase()
  const isGlobalReportsEditor =
    normalizedRole === "developer" ||
    normalizedRole === "super_admin" ||
    (normalizedRole === "admin" &&
      Array.isArray(currentUser.admin_domains) &&
      currentUser.admin_domains.includes("reports"))

  const managedDepartments =
    editableDepartments.length > 0
      ? editableDepartments
      : ([currentUser.department, ...(currentUser.lead_departments || [])].filter(Boolean) as string[])

  const canMutateReport = (report: WeeklyReport) => {
    if (isGlobalReportsEditor) return true
    return managedDepartments.includes(report.department)
  }

  const {
    data: reportsData,
    isLoading: loading,
    refetch: refetchReports,
  } = useQuery({
    queryKey: QUERY_KEYS.adminWeeklyReports({ weekFilter, yearFilter, deptFilter }),
    queryFn: () => fetchAdminWeeklyReports(supabase, weekFilter, yearFilter, deptFilter, initialDepartments),
  })

  const reports = reportsData?.reports ?? []
  const trackingData = reportsData?.trackingData ?? []

  const { data: lockState } = useQuery({
    queryKey: QUERY_KEYS.adminWeeklyReportLockState(weekFilter, yearFilter),
    queryFn: () => fetchAdminWeeklyReportLockState(supabase, weekFilter, yearFilter),
  })

  const isFilteredWeekLocked = lockState?.isLocked ?? false

  useEffect(() => {
    if (lockState && isAdminRole) {
      setMeetingDateInput(lockState.meetingDate || getDefaultMeetingDateIso(weekFilter, yearFilter))
      setMeetingGraceHours(lockState.graceHours || 24)
    }
  }, [lockState, isAdminRole])

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
    try {
      const { error } = await supabase.from("weekly_reports").delete().eq("id", id)
      if (error) throw error
      toast.success("Report deleted")
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminWeeklyReports() })
    } catch {
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
    } catch (error: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((error as any)?.message || "Failed to save meeting window")
    } finally {
      setSavingMeetingWindow(false)
    }
  }

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

  const runPptxExport = async (mode: WeeklyPptxMode, theme: WeeklyPptxTheme = "light") => {
    if (!pendingPptxExport) return
    if (pendingPptxExport.kind === "all") {
      await exportAllToPPTX(filteredReports, weekFilter, yearFilter, mode, theme)
    } else {
      const { exportToPPTX } = await import("@/lib/export-utils")
      await exportToPPTX(pendingPptxExport.report, mode, theme)
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
        <WeeklyReportExportActions
          filteredReports={filteredReports}
          weekFilter={weekFilter}
          yearFilter={yearFilter}
          onOpenAllPptx={openAllPptxModeDialog}
          onAddReport={() => {
            setEditingReport(null)
            setIsAdminDialogOpen(true)
          }}
        />
      }
      filters={
        <WeeklyReportFiltersBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          weekFilter={weekFilter}
          setWeekFilter={setWeekFilter}
          yearFilter={yearFilter}
          setYearFilter={setYearFilter}
          deptFilter={deptFilter}
          setDeptFilter={setDeptFilter}
          initialDepartments={initialDepartments}
          loading={loading}
          refetchReports={refetchReports}
          isAdminRole={isAdminRole}
          meetingDateInput={meetingDateInput}
          setMeetingDateInput={setMeetingDateInput}
          meetingGraceHours={meetingGraceHours}
          setMeetingGraceHours={setMeetingGraceHours}
          savingMeetingWindow={savingMeetingWindow}
          saveMeetingWindow={saveMeetingWindow}
        />
      }
    >
      <WeeklyReportTable
        loading={loading}
        filteredReports={filteredReports}
        expandedRows={expandedRows}
        trackingData={trackingData}
        isFilteredWeekLocked={isFilteredWeekLocked}
        canMutateReport={canMutateReport}
        onToggleRow={toggleRow}
        onEdit={(r) => {
          setEditingReport(r)
          setIsAdminDialogOpen(true)
        }}
        onDelete={(id) => setPendingDeleteId(id)}
        onExportPptx={openSinglePptxModeDialog}
      />

      <WeeklyReportAdminDialog
        isOpen={isAdminDialogOpen}
        onClose={() => setIsAdminDialogOpen(false)}
        report={editingReport}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminWeeklyReports() })}
        currentUser={currentUser}
      />

      <DeleteReportDialog
        pendingDeleteId={pendingDeleteId}
        onOpenChange={() => setPendingDeleteId(null)}
        onConfirm={(id) => {
          handleDelete(id)
          setPendingDeleteId(null)
        }}
      />

      <PptxModeDialog
        open={pptxModeDialogOpen}
        onOpenChange={(open) => {
          setPptxModeDialogOpen(open)
          if (!open) setPendingPptxExport(null)
        }}
        onSelect={runPptxExport}
      />
    </AdminTablePage>
  )
}
