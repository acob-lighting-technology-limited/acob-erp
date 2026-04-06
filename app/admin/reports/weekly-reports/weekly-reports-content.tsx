"use client"

import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { createClient } from "@/lib/supabase/client"
import { getCurrentOfficeWeek } from "@/lib/meeting-week"
import { toast } from "sonner"
import { fetchWeeklyReportLockState, getDefaultMeetingDateIso } from "@/lib/weekly-report-lock"
import { getDepartmentAliases, normalizeDepartmentName } from "@/shared/departments"

import { FileBarChart } from "lucide-react"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import {
  exportAllToPPTX,
  sortReportsByDepartment,
  type WeeklyDeptOrder,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface AdminWeeklyReportsData {
  reports: WeeklyReport[]
  trackingData: TrackerStatus[]
}

function expandDepartmentScope(departments: string[]) {
  const scoped = new Set<string>()
  departments.forEach((department) => {
    getDepartmentAliases(department).forEach((alias) => scoped.add(alias))
  })
  return Array.from(scoped)
}

function getDepartmentFilterValues(department: string) {
  return getDepartmentAliases(department)
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
    query = query.in("department", getDepartmentFilterValues(deptFilter))
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)

  const normalizedReports = (data || []).map((report) => ({
    ...report,
    department: normalizeDepartmentName(report.department),
  }))
  const sortedData = sortReportsByDepartment(normalizedReports)

  const { data: actions, error: actionsError } = await supabase
    .from("tasks")
    .select("id, department, status")
    .eq("category", "weekly_action")
    .eq("week_number", weekFilter)
    .eq("year", yearFilter)
    .in("department", expandDepartmentScope(initialDepartments))

  return {
    reports: sortedData,
    trackingData: actionsError
      ? []
      : (actions || []).map((action) => ({
          ...action,
          department: normalizeDepartmentName(action.department),
        })),
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

interface MeetingDocumentHelper {
  id: string
  file_name: string
  signed_url: string | null
  document_type?: "knowledge_sharing_session" | "minutes"
}

interface WeeklyReportsContentProps {
  initialDepartments: string[]
  employees: Array<{
    id: string
    full_name: string
    department: string
  }>
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

type OfficialBackfillStatus = {
  state: "idle" | "running" | "success" | "error"
  processed?: number
  created?: number
  existing?: number
  skipped?: number
  skippedDetails?: string[]
  error?: string
}

export function WeeklyReportsContent({
  initialDepartments,
  employees,
  scopedDepartments: _scopedDepartments = [],
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
  const [meetingTimeInput, setMeetingTimeInput] = useState("08:30")
  const [meetingGraceHours, setMeetingGraceHours] = useState(24)
  const [kssDepartmentInput, setKssDepartmentInput] = useState("none")
  const [kssPresenterIdInput, setKssPresenterIdInput] = useState("none")
  const [savingMeetingWindow, setSavingMeetingWindow] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [officialBackfillStatus, setOfficialBackfillStatus] = useState<OfficialBackfillStatus>({ state: "idle" })

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

  const { data: weekSetupData } = useQuery({
    queryKey: ["admin-week-setup", weekFilter, yearFilter],
    queryFn: async () => {
      const [meetingWindowResult, rosterResult] = await Promise.all([
        supabase
          .from("weekly_report_meeting_windows")
          .select("meeting_time")
          .eq("week_number", weekFilter)
          .eq("year", yearFilter)
          .maybeSingle(),
        supabase
          .from("kss_weekly_roster")
          .select("department, presenter_id")
          .eq("meeting_week", weekFilter)
          .eq("meeting_year", yearFilter)
          .maybeSingle(),
      ])

      if (meetingWindowResult.error) throw new Error(meetingWindowResult.error.message)
      if (rosterResult.error) throw new Error(rosterResult.error.message)

      return {
        meetingTime:
          typeof meetingWindowResult.data?.meeting_time === "string" ? meetingWindowResult.data.meeting_time : "08:30",
        kssDepartment:
          typeof rosterResult.data?.department === "string" && rosterResult.data.department.trim()
            ? rosterResult.data.department
            : "none",
        kssPresenterId:
          typeof rosterResult.data?.presenter_id === "string" && rosterResult.data.presenter_id
            ? rosterResult.data.presenter_id
            : "none",
      }
    },
  })

  const { data: selectedWeekDocuments = [] } = useQuery({
    queryKey: ["admin-weekly-report-helper-documents", weekFilter, yearFilter],
    queryFn: async (): Promise<MeetingDocumentHelper[]> => {
      const [kssRes, minutesRes] = await Promise.all([
        fetch(
          `/api/reports/meeting-week-documents?documentType=knowledge_sharing_session&currentOnly=true&week=${weekFilter}&year=${yearFilter}`
        ),
        fetch(
          `/api/reports/meeting-week-documents?documentType=minutes&currentOnly=true&week=${weekFilter}&year=${yearFilter}`
        ),
      ])

      const [kssPayload, minutesPayload] = await Promise.all([kssRes.json(), minutesRes.json()])
      if (!kssRes.ok) throw new Error(kssPayload.error || "Failed to fetch KSS document")
      if (!minutesRes.ok) throw new Error(minutesPayload.error || "Failed to fetch minutes document")

      return [...(kssPayload.data || []), ...(minutesPayload.data || [])]
    },
  })

  const isFilteredWeekLocked = lockState?.isLocked ?? false

  useEffect(() => {
    if (lockState && isAdminRole) {
      setMeetingDateInput(lockState.meetingDate || getDefaultMeetingDateIso(weekFilter, yearFilter))
      setMeetingGraceHours(lockState.graceHours || 24)
    }
  }, [isAdminRole, lockState, weekFilter, yearFilter])

  useEffect(() => {
    if (!weekSetupData || !isAdminRole) return
    setMeetingTimeInput(weekSetupData.meetingTime || "08:30")
    setKssDepartmentInput(weekSetupData.kssDepartment || "none")
    setKssPresenterIdInput(weekSetupData.kssPresenterId || "none")
  }, [isAdminRole, weekSetupData])

  useEffect(() => {
    if (!isAdminRole) return

    setOfficialBackfillStatus({ state: "running" })
    void fetch("/api/reports/official-exports", {
      method: "POST",
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as {
          success?: boolean
          processed?: number
          results?: Array<{ status?: string; week?: number; year?: number; type?: string; error?: string }>
          error?: string
        } | null

        if (!response.ok) {
          throw new Error(payload?.error || "Failed to backfill official PDFs")
        }

        const results = payload?.results || []
        const created = results.filter((item) => item.status === "created").length
        const existing = results.filter((item) => item.status === "existing").length
        const skippedEntries = results.filter((item) => item.status === "skipped")
        const skipped = skippedEntries.length
        const skippedDetails = skippedEntries.slice(0, 3).map((item) => {
          const typeLabel = item.type === "action_point" ? "action points" : "weekly report"
          const periodLabel =
            item.week && item.year ? `W${item.week}/${item.year}` : "an unknown week"
          return `${periodLabel} ${typeLabel}: ${item.error || "Skipped"}`
        })

        setOfficialBackfillStatus({
          state: "success",
          processed: payload?.processed || 0,
          created,
          existing,
          skipped,
          skippedDetails,
        })
      })
      .catch((error: unknown) => {
        setOfficialBackfillStatus({
          state: "error",
          error: error instanceof Error ? error.message : "Failed to backfill official PDFs",
        })
      })
  }, [isAdminRole])

  const presenterOptions = employees
    .filter((employee) => normalizeDepartmentName(employee.department) === normalizeDepartmentName(kssDepartmentInput))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  const kssDocument = selectedWeekDocuments.find((doc) => doc.document_type === "knowledge_sharing_session") || null
  const minutesDocument = selectedWeekDocuments.find((doc) => doc.document_type === "minutes") || null

  const handleDownloadMeetingDocument = async (meetingDocument: MeetingDocumentHelper) => {
    if (!meetingDocument.signed_url) {
      toast.error("No file available to download yet")
      return
    }

    try {
      const toastId = toast.loading("Preparing download...")
      const anchor = document.createElement("a")
      anchor.href = meetingDocument.signed_url
      anchor.download = meetingDocument.file_name
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => {
        toast.dismiss(toastId)
      }, 6000)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to download document")
    }
  }

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
    if (!meetingTimeInput) {
      toast.error("Meeting time is required")
      return
    }
    if (meetingGraceHours < 0 || meetingGraceHours > 24) {
      toast.error("Grace hours must be between 0 and 24")
      return
    }
    if (kssDepartmentInput === "none") {
      toast.error("KSS department is required")
      return
    }
    if (kssPresenterIdInput === "none") {
      toast.error("KSS presenter is required")
      return
    }

    setSavingMeetingWindow(true)
    try {
      const [meetingWindowResult, rosterResult] = await Promise.all([
        supabase.from("weekly_report_meeting_windows").upsert(
          {
            week_number: weekFilter,
            year: yearFilter,
            meeting_date: meetingDateInput,
            meeting_time: meetingTimeInput,
            grace_hours: meetingGraceHours,
            updated_by: currentUser.id,
            created_by: currentUser.id,
          },
          { onConflict: "week_number,year" }
        ),
        supabase.from("kss_weekly_roster").upsert(
          {
            meeting_week: weekFilter,
            meeting_year: yearFilter,
            department: kssDepartmentInput,
            presenter_id: kssPresenterIdInput,
            is_active: true,
            created_by: currentUser.id,
          },
          { onConflict: "meeting_week,meeting_year" }
        ),
      ])

      if (meetingWindowResult.error) throw meetingWindowResult.error
      if (rosterResult.error) throw rosterResult.error

      toast.success("Week setup saved")
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminWeeklyReportLockState(weekFilter, yearFilter) }),
        queryClient.invalidateQueries({ queryKey: ["admin-week-setup", weekFilter, yearFilter] }),
      ])
    } catch (error: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((error as any)?.message || "Failed to save week setup")
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

  const runPptxExport = async (
    mode: WeeklyPptxMode,
    theme: WeeklyPptxTheme = "light",
    order: WeeklyDeptOrder = "default"
  ) => {
    if (!pendingPptxExport) return
    const exportMeetingDate = lockState?.meetingDate || meetingDateInput
    if (pendingPptxExport.kind === "all") {
      await exportAllToPPTX(filteredReports, weekFilter, yearFilter, mode, theme, exportMeetingDate, order)
    } else {
      const { exportToPPTX } = await import("@/lib/export-utils")
      await exportToPPTX(pendingPptxExport.report, mode, theme, exportMeetingDate)
    }
    setPptxModeDialogOpen(false)
    setPendingPptxExport(null)
  }

  return (
    <AdminTablePage
      title="Weekly Reports"
      description="Review and export departmental reports"
      icon={FileBarChart}
      backLinkHref="/admin/reports/general-meeting"
      backLinkLabel="Back to General Meeting"
      actionsPlacement="below"
      actions={
        <WeeklyReportExportActions
          filteredReports={filteredReports}
          weekFilter={weekFilter}
          yearFilter={yearFilter}
          meetingDate={lockState?.meetingDate || meetingDateInput}
          kssDocument={kssDocument}
          minutesDocument={minutesDocument}
          onDownloadDocument={handleDownloadMeetingDocument}
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
          meetingTimeInput={meetingTimeInput}
          setMeetingTimeInput={setMeetingTimeInput}
          meetingGraceHours={meetingGraceHours}
          setMeetingGraceHours={setMeetingGraceHours}
          kssDepartmentInput={kssDepartmentInput}
          setKssDepartmentInput={setKssDepartmentInput}
          kssPresenterIdInput={kssPresenterIdInput}
          setKssPresenterIdInput={setKssPresenterIdInput}
          presenterOptions={presenterOptions}
          isWeekSetupLocked={isFilteredWeekLocked}
          savingMeetingWindow={savingMeetingWindow}
          saveMeetingWindow={saveMeetingWindow}
        />
      }
    >
      {officialBackfillStatus.state !== "idle" ? (
        <Alert
          className={
            officialBackfillStatus.state === "error"
              ? "mb-4 border-red-200 bg-red-50 text-red-900"
              : officialBackfillStatus.state === "running"
                ? "mb-4 border-blue-200 bg-blue-50 text-blue-900"
                : "mb-4 border-emerald-200 bg-emerald-50 text-emerald-900"
          }
        >
          <AlertTitle>
            {officialBackfillStatus.state === "running"
              ? "Official PDFs backfilling"
              : officialBackfillStatus.state === "error"
                ? "Official PDF backfill failed"
                : "Official PDFs synced"}
          </AlertTitle>
          <AlertDescription>
            {officialBackfillStatus.state === "running"
              ? "Locked weeks are being checked and stored in SharePoint in the background."
              : officialBackfillStatus.state === "error"
                ? officialBackfillStatus.error || "The backfill could not complete."
                : `Processed ${officialBackfillStatus.processed || 0} export checks: ${officialBackfillStatus.created || 0} created, ${officialBackfillStatus.existing || 0} already present, ${officialBackfillStatus.skipped || 0} skipped.${officialBackfillStatus.skippedDetails?.length ? ` Skipped details: ${officialBackfillStatus.skippedDetails.join(" | ")}` : ""}`}
          </AlertDescription>
        </Alert>
      ) : null}

      <WeeklyReportTable
        loading={loading}
        filteredReports={filteredReports}
        meetingDate={lockState?.meetingDate || meetingDateInput}
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
        showOrderStep={pendingPptxExport?.kind === "all"}
      />
    </AdminTablePage>
  )
}
