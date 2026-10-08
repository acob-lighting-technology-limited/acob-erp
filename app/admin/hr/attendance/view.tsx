"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter, DataTableTab } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DailyRosterView } from "./_components/daily-roster-view"
import { CalendarView } from "./_components/calendar-view"
import type { EmployeeOption } from "./_components/calendar-view"
import { AppealsView } from "./_components/appeals-view"
import { ChangeLogView, type ChangeLogViewHandle } from "./_components/change-log-view"
import { LeaderboardView } from "./_components/leaderboard-view"
import { AttendanceManagerDialog } from "./_components/attendance-manager-dialog"
import { useAdminScopeOptional } from "@/components/admin-scope-context"
import { AttendanceReportDialog } from "./_components/attendance-report-dialog"
import { AttendanceExportDialog } from "./_components/attendance-export-dialog"
import { Select } from "@/components/ui/select"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { Badge } from "@/components/ui/badge"
import { BarChart3, Download, FileText, Users, Clock, AlertCircle, Settings2, Mail } from "lucide-react"
import { logger } from "@/lib/logger"
import { getAttendanceMonthOptions, monthBounds, quarterBounds } from "@/lib/hr/attendance-utils"
import { type AttendancePolicy, DEFAULT_ATTENDANCE_POLICY } from "@/lib/org-config"
import { apiFetch, apiJson } from "@/lib/api-client"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { formatNumber } from "@/lib/format"
import {
  type AttendanceReport,
  currentYearMonth,
  type AttendanceReportData,
  NO_REPORTS,
  NO_DEPARTMENTS,
  NO_HOLIDAYS,
  EmployeeExpandPanel,
} from "./_components/employee-expand-panel"

const log = logger("hr-attendance-reports")

type AttendanceTab = "summary" | "daily" | "calendar" | "appeals" | "change-log" | "leaderboard"

const ATTENDANCE_TABS: DataTableTab[] = [
  { key: "daily", label: "Daily Roster" },
  { key: "summary", label: "Summary" },
  { key: "leaderboard", label: "Leaderboard" },
  { key: "calendar", label: "Calendar" },
  { key: "appeals", label: "Appeals" },
  { key: "change-log", label: "Change log" },
]

export function AttendanceReportsPage({
  backLinkHref,
  lockedDepartment,
}: { backLinkHref?: string; lockedDepartment?: string } = {}) {
  const searchParams = useSearchParams()
  // Notifications deep-link straight to a tab (e.g. appeal alerts → ?tab=appeals).
  const requestedTab = searchParams.get("tab")
  const [activeTab, setActiveTab] = useState<AttendanceTab>(
    ATTENDANCE_TABS.some((t) => t.key === requestedTab) ? (requestedTab as AttendanceTab) : "daily"
  )
  // Rows currently visible in the table (after search + filters + sort).
  const [processedReports, setProcessedReports] = useState<AttendanceReport[]>([])
  const [yearMonth, setYearMonth] = useState(currentYearMonth)
  const [periodMode, setPeriodMode] = useState<"month" | "quarter">("month")
  const [quarter, setQuarter] = useState<"Q1" | "Q2" | "Q3" | "Q4">("Q1")
  const [quarterYear, setQuarterYear] = useState(new Date().getFullYear())
  const reportDepartment = lockedDepartment || "all"
  const [isExportOpen, setIsExportOpen] = useState(false)
  // Admin & HR only: department leads could grant leave from the manager with no
  // approval (see requireAttendanceAdmin). The server enforces it; this hides it.
  const adminScope = useAdminScopeOptional()
  const canUseAttendanceManager = Boolean(adminScope?.isAdminLike) && !lockedDepartment
  // Export follows the open tab: on the Change log it exports the log, not attendance.
  const changeLogRef = useRef<ChangeLogViewHandle>(null)
  const [changeLogCount, setChangeLogCount] = useState(0)
  const isChangeLogTab = activeTab === "change-log"
  // Unified Attendance Manager dialog
  const [managerOpen, setManagerOpen] = useState(false)
  const [reportDialogOpen, setReportDialogOpen] = useState(false)

  const queryClient = useQueryClient()
  const reportsKey = QUERY_KEYS.attendanceReports({ periodMode, yearMonth, quarter, quarterYear, reportDepartment })
  const reportQuery = useQuery({
    queryKey: reportsKey,
    queryFn: async (): Promise<AttendanceReportData> => {
      const { start, end } = periodMode === "month" ? monthBounds(yearMonth) : quarterBounds(quarterYear, quarter)
      const params = new URLSearchParams({ start_date: start, end_date: end, department: reportDepartment })
      const payload = await apiJson<{ data?: AttendanceReport[]; departments?: string[]; policy?: AttendancePolicy }>(
        `/api/hr/attendance/reports?${params.toString()}`,
        { cache: "no-store" }
      )
      const activePeriodLabel = periodMode === "month" ? yearMonth : `${quarter} ${quarterYear}`
      const activeCycleLabel = periodMode === "month" ? "Monthly" : "Quarterly"
      return {
        reports: (payload.data ?? []).map((row) => ({
          ...row,
          period_label: activePeriodLabel,
          cycle_label: activeCycleLabel,
        })),
        departments: payload.departments ?? [],
        // Served by the reports API so day breakdowns here charge the same hours the server did.
        policy: payload.policy ? { ...DEFAULT_ATTENDANCE_POLICY, ...payload.policy } : DEFAULT_ATTENDANCE_POLICY,
      }
    },
    placeholderData: keepPreviousData,
  })
  const loading = reportQuery.isFetching
  const reports = reportQuery.data?.reports ?? NO_REPORTS
  const loadedDepartments = reportQuery.data?.departments ?? NO_DEPARTMENTS
  const departments = useMemo(
    () => (lockedDepartment ? [lockedDepartment] : loadedDepartments),
    [lockedDepartment, loadedDepartments]
  )
  const policy = reportQuery.data?.policy ?? DEFAULT_ATTENDANCE_POLICY
  const generateReport = useCallback(() => void reportQuery.refetch(), [reportQuery])
  const setReports = useCallback(
    (update: (prev: AttendanceReport[]) => AttendanceReport[]) =>
      queryClient.setQueryData<AttendanceReportData>(
        QUERY_KEYS.attendanceReports({ periodMode, yearMonth, quarter, quarterYear, reportDepartment }),
        (current) => (current ? { ...current, reports: update(current.reports) } : current)
      ),
    [queryClient, periodMode, yearMonth, quarter, quarterYear, reportDepartment]
  )

  const holidaysQuery = useQuery({
    queryKey: QUERY_KEYS.attendanceHolidays(yearMonth),
    queryFn: async () =>
      (
        await apiJson<{ data?: Array<{ holiday_date: string; name?: string | null }> }>(
          `/api/admin/hr/attendance/holidays?month=${yearMonth}`,
          { cache: "no-store" }
        )
      ).data ?? [],
  })
  const holidays = holidaysQuery.data ?? NO_HOLIDAYS
  const loadHolidays = useCallback(() => void holidaysQuery.refetch(), [holidaysQuery])

  const refreshSingleEmployeeSummary = useCallback(
    async (userId: string) => {
      try {
        const { start, end } = periodMode === "month" ? monthBounds(yearMonth) : quarterBounds(quarterYear, quarter)
        const params = new URLSearchParams({
          start_date: start,
          end_date: end,
          department: reportDepartment,
          user_id: userId,
        })
        const response = await apiFetch(`/api/hr/attendance/reports?${params.toString()}`, { cache: "no-store" })
        const payload = (await response.json().catch(() => null)) as {
          data?: AttendanceReport[]
          error?: string
        } | null
        if (!response.ok) throw new Error(payload?.error ?? "Failed to refresh employee summary")
        const row = payload?.data?.[0]
        if (!row) return

        const activePeriodLabel = periodMode === "month" ? yearMonth : `${quarter} ${quarterYear}`
        const activeCycleLabel = periodMode === "month" ? "Monthly" : "Quarterly"
        setReports((prev) =>
          prev.map((r) =>
            r.user_id === userId
              ? {
                  ...row,
                  period_label: activePeriodLabel,
                  cycle_label: activeCycleLabel,
                }
              : r
          )
        )
      } catch (error) {
        log.error("Failed to refresh single employee summary:", error)
      }
    },
    [periodMode, quarter, quarterYear, reportDepartment, yearMonth, setReports]
  )

  const departmentOptions = useMemo(() => departments.map((d) => ({ value: d, label: d })), [departments])

  const monthOptions = useMemo(() => getAttendanceMonthOptions(), [])

  const stats = useMemo(() => {
    const totalHours = reports.reduce((a, r) => a + (r.total_hours ?? 0), 0)
    const totalMissedHours = reports.reduce((a, r) => a + (r.total_missed_hours ?? 0), 0)
    return {
      employees: reports.length,
      totalHours: `${formatNumber(Math.round(totalHours * 10) / 10)} hrs`,
      totalMissedHours: `${formatNumber(Math.round(totalMissedHours * 10) / 10)} hrs`,
    }
  }, [reports])

  const employeeOptions = useMemo<EmployeeOption[]>(
    () =>
      reports.map((r) => ({
        user_id: r.user_id,
        user_name: r.user_name,
        department: r.department,
        attendance_exempt: r.attendance_exempt,
      })),
    [reports]
  )

  const columns: DataTableColumn<AttendanceReport>[] = [
    {
      key: "user_name",
      label: "Employee",
      sortable: true,
      accessor: (r) => r.user_name,
      render: (r) => (
        <div>
          <div className="font-medium">{r.user_name}</div>
          <div className="text-muted-foreground text-xs">{r.department}</div>
        </div>
      ),
      resizable: true,
      initialWidth: 200,
    },
    {
      key: "early_days",
      label: "Early",
      sortable: true,
      accessor: (r) => r.early_days ?? 0,
      render: (r) => <span className="text-green-600">{r.early_days ?? 0}</span>,
      align: "center",
      hideOnMobile: true,
    },
    {
      key: "present_days",
      label: "Present",
      sortable: true,
      accessor: (r) => r.present_days,
      render: (r) => <span className="text-blue-600">{r.present_days}</span>,
      align: "center",
      hideOnMobile: true,
    },
    {
      key: "absent_days",
      label: "Absent",
      sortable: true,
      accessor: (r) => r.absent_days,
      render: (r) => <span className="text-red-600">{r.absent_days}</span>,
      align: "center",
      hideOnMobile: true,
    },
    {
      key: "incomplete_days",
      label: "Incomplete",
      sortable: true,
      accessor: (r) => r.incomplete_days ?? 0,
      render: (r) => <span className="text-cyan-600">{r.incomplete_days ?? 0}</span>,
      align: "center",
      hideOnMobile: true,
    },
    {
      key: "lwp_awp_days",
      label: "LWP/IWP/AWP",
      sortable: true,
      accessor: (r) =>
        (r.lateness_with_permission_days ?? 0) +
        (r.incomplete_with_permission_days ?? 0) +
        (r.absent_with_permission_days ?? 0),
      render: (r) => (
        <span className="text-amber-600">
          {(r.lateness_with_permission_days ?? 0) +
            (r.incomplete_with_permission_days ?? 0) +
            (r.absent_with_permission_days ?? 0)}
        </span>
      ),
      align: "center",
      hideOnMobile: true,
    },
    {
      key: "total_hours",
      label: "Hours",
      sortable: true,
      accessor: (r) => r.total_hours,
      render: (r) => r.total_hours.toFixed(1),
      align: "center",
      hideOnMobile: true,
    },
    {
      key: "total_missed_hours",
      label: "Hrs Missed",
      sortable: true,
      accessor: (r) => r.total_missed_hours ?? 0,
      render: (r) =>
        (r.total_missed_hours ?? 0) > 0 ? (
          <span className="text-orange-500">{(r.total_missed_hours ?? 0).toFixed(1)}h</span>
        ) : (
          <span className="text-muted-foreground text-xs">0h</span>
        ),
      align: "center",
      hideOnMobile: true,
    },
  ]

  const reportFilters: DataTableFilter<AttendanceReport>[] = [
    {
      key: "department",
      label: "Department",
      options: departmentOptions,
      placeholder: lockedDepartment || "All Departments",
    },
    {
      key: "cycle_label",
      label: "Cycle",
      options: [
        { value: "Monthly", label: "Monthly" },
        { value: "Quarterly", label: "Quarterly" },
      ],
      placeholder: "All Cycles",
    },
    {
      key: "month",
      label: "Month",
      options: monthOptions,
      placeholder: "Select Month",
      multi: false,
      defaultValues: [yearMonth],
      mode: "custom",
      pinned: true,
      filterFn: () => true,
    },
  ]

  return (
    <DataTablePage
      title="Attendance Reports"
      description={
        activeTab === "summary"
          ? "Monthly attendance performance by employee."
          : activeTab === "daily"
            ? "All check-in records for a selected date."
            : activeTab === "calendar"
              ? "Month-view calendar for an individual employee."
              : activeTab === "leaderboard"
                ? "Rankings across punctuality, hours, and reliability for the selected period."
                : activeTab === "change-log"
                  ? "Every change made to attendance by hand or by an appeal decision, for audit and export."
                  : "Records needing attention — late arrivals, missing clock-outs, absences."
      }
      icon={BarChart3}
      backLink={{ href: backLinkHref ?? "/admin/hr", label: "Back to HR" }}
      tabs={ATTENDANCE_TABS}
      activeTab={activeTab}
      onTabChange={(t) => setActiveTab(t as AttendanceTab)}
      actions={
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" onClick={() => setReportDialogOpen(true)} size="sm" aria-label="Reports">
                <Mail className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Reports</span>
                <span className="sr-only sm:hidden">Reports</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Attendance Reports</TooltipContent>
          </Tooltip>
          {canUseAttendanceManager && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={() => setManagerOpen(true)}
                  size="sm"
                  aria-label="Attendance Manager"
                >
                  <Settings2 className="h-4 w-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Attendance Manager</span>
                  <span className="sr-only sm:hidden">Attendance Manager</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Attendance Manager</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={() => (isChangeLogTab ? changeLogRef.current?.exportToExcel() : setIsExportOpen(true))}
                disabled={isChangeLogTab ? changeLogCount === 0 : reports.length === 0}
                size="sm"
                aria-label="Export"
              >
                <Download className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Export</span>
                <span className="sr-only sm:hidden">Export</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isChangeLogTab ? "Export Change Log" : "Export Attendance Data"}
            </TooltipContent>
          </Tooltip>
        </div>
      }
      stats={
        activeTab === "summary" ? (
          <StatGrid>
            <StatCard
              variant="compact"
              title="Employees"
              value={stats.employees}
              icon={Users}
              iconBgColor="bg-blue-500/10"
              iconColor="text-blue-500"
            />
            <StatCard
              variant="compact"
              title="Total Work Hours"
              value={stats.totalHours}
              icon={Clock}
              iconBgColor="bg-emerald-500/10"
              iconColor="text-emerald-500"
            />
            <StatCard
              variant="compact"
              title="Missed Hours"
              value={stats.totalMissedHours}
              icon={AlertCircle}
              iconBgColor="bg-amber-500/10"
              iconColor="text-amber-500"
            />
          </StatGrid>
        ) : undefined
      }
    >
      {activeTab === "daily" && <DailyRosterView departments={departments} lockedDepartment={lockedDepartment} />}
      {activeTab === "leaderboard" && <LeaderboardView departments={departments} lockedDepartment={lockedDepartment} />}
      {activeTab === "calendar" && <CalendarView employees={employeeOptions} />}
      {activeTab === "appeals" && <AppealsView lockedDepartment={lockedDepartment} />}
      {activeTab === "change-log" && (
        <ChangeLogView
          ref={changeLogRef}
          lockedDepartment={lockedDepartment}
          onVisibleCountChange={setChangeLogCount}
        />
      )}
      {activeTab === "summary" && (
        <DataTable<AttendanceReport>
          data={reports}
          columns={columns}
          onProcessedDataChange={setProcessedReports}
          filters={reportFilters}
          getRowId={(r) => r.user_id}
          pagination={{ pageSize: 50 }}
          searchPlaceholder="Search employee or department…"
          searchFn={(r, q) => [r.user_name, r.department].join(" ").toLowerCase().includes(q)}
          isLoading={loading}
          onFilterChange={(filters) => {
            const selectedMonth = filters.month?.[0]
            if (selectedMonth && selectedMonth !== yearMonth) {
              setYearMonth(selectedMonth)
            }
          }}
          expandable={{
            render: (r) => (
              <EmployeeExpandPanel
                report={r}
                yearMonth={yearMonth}
                policy={policy}
                onRecordChanged={refreshSingleEmployeeSummary}
              />
            ),
          }}
          viewToggle
          contactsView
          stickyToolbar
          defaultViewMode={{ mobile: "contacts", desktop: "list" }}
          mobileRow={{
            title: (r) => r.user_name,
            subtitle: (r) =>
              `${r.department} · ${r.present_days} present · ${r.late_days} late · ${r.absent_days} absent`,
            trailing: (r) =>
              r.attendance_exempt ? (
                <Badge variant="outline" className="text-xs">
                  Exempt
                </Badge>
              ) : (
                <span className="text-success-foreground font-mono text-xs font-semibold">{r.total_hours} hrs</span>
              ),
          }}
          cardRenderer={(r) => (
            <div className="space-y-3 rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold">{r.user_name}</h4>
                  <p className="text-muted-foreground text-xs">{r.department}</p>
                </div>
                {r.attendance_exempt && <Badge variant="outline">Exempt</Badge>}
              </div>
              <div className="border-border/40 grid grid-cols-2 gap-2 border-t pt-2 text-xs">
                <div>
                  <span className="text-muted-foreground block text-xs uppercase">Early / Present</span>
                  <span className="text-success-foreground font-semibold">
                    {r.early_days ?? 0} early / {r.present_days} present
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs uppercase">Absent</span>
                  <span className="text-danger-foreground font-semibold">{r.absent_days} days</span>
                </div>
              </div>
            </div>
          )}
          emptyTitle={loading ? "Loading attendance report…" : "No attendance report"}
          emptyDescription="No attendance results available for this period."
          emptyIcon={FileText}
          skeletonRows={6}
        />
      )}
      <AttendanceExportDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        department={lockedDepartment}
        monthOptions={monthOptions}
      />

      {canUseAttendanceManager && (
        <AttendanceManagerDialog
          open={managerOpen}
          onOpenChange={setManagerOpen}
          reports={reports}
          yearMonth={yearMonth}
          holidays={holidays}
          onHolidaysChanged={() => {
            void loadHolidays()
            void generateReport()
          }}
          onReportChanged={() => void generateReport()}
        />
      )}

      <AttendanceReportDialog open={reportDialogOpen} onOpenChange={setReportDialogOpen} />
    </DataTablePage>
  )
}
