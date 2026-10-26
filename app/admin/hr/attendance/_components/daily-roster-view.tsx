"use client"

import { useEffect, useMemo, useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import {
  Users,
  Clock,
  AlertCircle,
  FileText,
  Pencil,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Building,
  MessageSquare,
  Calendar,
} from "lucide-react"
import { toast } from "sonner"
import { toLocalISODate, isLate } from "@/lib/hr/attendance-utils"
import { formatWATDate } from "@/lib/utils/date"
import { computeAttendanceDay, netDayHoursFor } from "@/lib/hr/attendance-ssot"
import { type AttendancePolicy, DEFAULT_ATTENDANCE_POLICY } from "@/lib/org-config"
import { isEarlyDeparture, getManualStatusEditOptions } from "@/lib/hr/attendance-status"
import { cn } from "@/lib/utils"
import { StatusBadge, formatTime, labelSource } from "./status-badge"
import { ClockTimes, NameWithDept } from "./clock-times"
import { useDepartmentCodes } from "@/hooks/use-department-code"
import { apiFetch, apiJson } from "@/lib/api-client"
import { orderRoster, rosterPhase } from "@/lib/hr/roster-order"
import { useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { StaffAvatar } from "@/components/ui/staff-avatar"
import { useStaffAvatars } from "@/hooks/use-staff-avatars"

function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null
  const [h, m] = value.split(":").map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

export function getHourBreakdown(r: AttendanceRecord, policy: AttendancePolicy = DEFAULT_ATTENDANCE_POLICY) {
  const inMin = parseTimeToMinutes(r.clock_in)
  const outMin = parseTimeToMinutes(r.clock_out)

  const covered =
    r.status === "waiver" ||
    r.status === "on_leave" ||
    r.status === "holiday" ||
    r.status === "exempted" ||
    r.status === "out_of_station" ||
    r.status === "absent_with_permission" ||
    r.status === "lateness_with_permission" ||
    r.status === "cds"
  if (covered) {
    const total = inMin !== null && outMin !== null && outMin > inMin ? (outMin - inMin) / 60 : null
    return { total, work: null, overtime: null, missed: null }
  }

  // One punch only — surface what the day actually costs (the recorded side's
  // bracket plus the incomplete penalty) instead of a dash. Work stays blank
  // because the missing half of the day is unverifiable.
  // If the day is still in progress (today, clock_in present, no clock_out yet)
  // suppress the incomplete penalty — only the late bracket is shown provisionally.
  if ((inMin === null) !== (outMin === null)) {
    const isToday = r.date === toLocalISODate()
    const isInProgress = isToday && Boolean(r.clock_in) && !r.clock_out
    const { hoursLost } = computeAttendanceDay({
      status: r.status ?? "incomplete",
      clockIn: r.clock_in,
      clockOut: r.clock_out,
      policy,
      earlyCloseTime: r.early_closure_time ?? null,
      lateResumptionTime: r.late_resumption_time ?? null,
      inProgress: isInProgress,
    })
    return { total: null, work: null, overtime: null, missed: hoursLost }
  }

  if (inMin === null || outMin === null || outMin <= inMin) {
    if (r.status === "absent" || r.status === "lwop" || r.status === "leave_without_pay") {
      return { total: null, work: 0, overtime: null, missed: netDayHoursFor(policy) }
    }
    return { total: null, work: null, overtime: null, missed: null }
  }
  const total = (outMin - inMin) / 60

  // Work, missed and overtime all come from the SSOT. Work and missed sit on the
  // bracketed 8.5-hour scale and always add up to the net day; overtime is strictly
  // time past the configured shift end, so arriving early is not overtime.
  // Only "total" is raw clock time.
  const {
    hoursLost: missed,
    hoursWorked: work,
    overtimeHours: overtime,
  } = computeAttendanceDay({
    status: r.status,
    clockIn: r.clock_in,
    clockOut: r.clock_out,
    policy,
    earlyCloseTime: r.early_closure_time ?? null,
    lateResumptionTime: r.late_resumption_time ?? null,
  })

  return { total, work, overtime, missed }
}

export interface AttendanceRecord {
  id: string
  user_id: string
  user_name: string
  department: string
  date: string
  clock_in: string | null
  clock_out: string | null
  total_hours: number | null
  status: string
  source: string | null
  clock_in_source?: string | null
  clock_out_source?: string | null
  waived?: boolean
  manual_comment?: string | null
  early_closure_time?: string | null
  late_resumption_time?: string | null
  pending_appeal?: {
    id: string
    stage: string
    requested_status: string
    initiated_by_role: string
  } | null
}

interface DailyRosterViewProps {
  departments: string[]
  lockedDepartment?: string
}

/** How often today's roster reloads itself. */
const AUTO_REFRESH_MS = 2 * 60 * 1000

/** "17:00" -> "5:00 PM". */
function formatClock12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm
  const suffix = h >= 12 ? "PM" : "AM"
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`
}

function getPendingAppealBadge(appeal: { stage: string; initiated_by_role?: string | null }) {
  if (appeal.stage === "pending_lead") {
    if (appeal.initiated_by_role === "admin_manual") {
      return {
        label: "Pending Lead",
        tooltip: "Admin staged alteration — awaiting Department Lead confirmation",
        className: "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
      }
    }
    return {
      label: "Pending Both",
      tooltip: "Employee appeal — awaiting Lead endorsement, then Admin approval",
      className: "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    }
  }

  if (appeal.stage === "pending_admin") {
    return {
      label: "Pending Admin",
      tooltip: "Awaiting Admin & HR final approval",
      className: "border-blue-300 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
    }
  }

  if (appeal.stage === "pending_hr_lead") {
    return {
      label: "Pending HR Lead",
      tooltip: "Awaiting Admin & HR Lead final approval",
      className: "border-purple-300 bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
    }
  }

  return {
    label: "Pending Review",
    tooltip: "Awaiting approval",
    className: "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  }
}

export function DailyRosterView({ departments, lockedDepartment }: DailyRosterViewProps) {
  const staffAvatars = useStaffAvatars()
  const deptCode = useDepartmentCodes()
  const [rosterDate, setRosterDate] = useState(toLocalISODate())
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null)
  const [editForm, setEditForm] = useState({ status: "", manual_comment: "" })
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  // Ticks each minute so an open page switches from arrivals to departures at closing.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const {
    data: roster,
    isLoading: loading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEYS.dailyRoster(rosterDate, lockedDepartment ?? null),
    queryFn: async () => {
      const params = new URLSearchParams({ start_date: rosterDate, end_date: rosterDate, include_all: "1" })
      if (lockedDepartment) params.set("department", lockedDepartment)
      const payload = await apiJson<{
        records?: AttendanceRecord[]
        policy?: Partial<AttendancePolicy>
        close_time?: unknown
      }>(`/api/admin/hr/attendance/records?${params}`, { cache: "no-store" })
      return {
        records: payload.records ?? [],
        // Served by the records API so day breakdowns here charge the same hours the server did.
        policy: { ...DEFAULT_ATTENDANCE_POLICY, ...payload.policy } as AttendancePolicy,
        // The day's closing time (early closure or policy end).
        closeTime: typeof payload.close_time === "string" ? payload.close_time : null,
      }
    },
    // A live check should not need a Refresh button: reload quietly every two
    // minutes while today's roster is open. Past days do not change.
    refetchInterval: (query) => {
      const data = query.state.data
      const close = data?.closeTime ?? data?.policy.endTime ?? DEFAULT_ATTENDANCE_POLICY.endTime
      return rosterPhase({ rosterDate, now: new Date(), closeTime: close }) !== null ? AUTO_REFRESH_MS : false
    },
    meta: { errorMessage: "Failed to load daily roster" },
  })
  const records = useMemo(() => roster?.records ?? [], [roster])
  const policy = roster?.policy ?? DEFAULT_ATTENDANCE_POLICY
  const closeTime = roster?.closeTime ?? null
  const load = async () => {
    setRefreshing(true)
    try {
      const result = await refetch()
      if (result.isError) {
        toast.error("Failed to refresh roster")
      } else {
        toast.success("Roster refreshed")
      }
    } catch {
      toast.error("Failed to refresh roster")
    } finally {
      setRefreshing(false)
    }
  }

  // Default order only - clicking a column header still sorts by that column.
  const phase = rosterPhase({ rosterDate, now, closeTime: closeTime ?? policy.endTime })
  const orderedRecords = useMemo(() => orderRoster(records, phase), [records, phase])
  // A live check should not need a Refresh button: reload quietly every two
  // minutes while today's roster is open. Past days do not change.
  const closingLabel = formatClock12((closeTime ?? policy.endTime).slice(0, 5))
  const isLive = phase !== null

  function openEdit(record: AttendanceRecord) {
    const clockIn = record.clock_in ?? null
    const clockOut = record.clock_out ?? null
    const hasClockIn = Boolean(clockIn)
    const hasClockOut = Boolean(clockOut)
    const hasAnyPunch = hasClockIn || hasClockOut

    const isLatePunch = hasClockIn && isLate(clockIn)
    const isEarlyOut = hasClockOut && isEarlyDeparture(clockOut as string)
    const isOnTimePresent = hasClockIn && hasClockOut && !isLatePunch && !isEarlyOut

    let initialStatus = ""
    if (!hasAnyPunch) {
      initialStatus = "absent_with_permission"
    } else if (!isOnTimePresent) {
      initialStatus = "lateness_with_permission"
    }

    setEditRecord(record)
    setEditForm({
      status:
        record.status && ["lateness_with_permission", "absent_with_permission"].includes(record.status)
          ? record.status
          : initialStatus,
      manual_comment: record.manual_comment ?? "",
    })
  }

  async function saveEdit() {
    if (!editRecord) return
    setSaving(true)
    try {
      // Synthetic rows (employees with no record for the day) have no real id → create instead of update.
      const isNew = editRecord.id.startsWith("missing-")
      let res: Response
      if (isNew) {
        const body: Record<string, unknown> = {
          user_id: editRecord.user_id,
          date: editRecord.date,
          waived: false,
          manual_comment: editForm.manual_comment,
          status: editForm.status,
          clock_in: null,
          clock_out: null,
        }
        res = await apiFetch(`/api/admin/hr/attendance/records`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      } else {
        const body: Record<string, unknown> = {
          waived: false,
          manual_comment: editForm.manual_comment,
          status: editForm.status,
        }
        res = await apiFetch(`/api/admin/hr/attendance/records/${editRecord.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      }
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error ?? "Failed to save")
      if (payload?.staged) {
        toast.info(payload.message || "Status alteration staged awaiting department lead confirmation.")
      } else {
        toast.success(isNew ? "Record created" : "Record updated")
      }
      setEditRecord(null)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const stats = useMemo(
    () => ({
      early: records.filter((r) => r.status === "early").length,
      present: records.filter((r) =>
        ["early", "present", "late", "incomplete", "lateness_with_permission"].includes(r.status ?? "")
      ).length,
      late: records.filter((r) => r.status === "late").length,
      incomplete: records.filter((r) => r.status === "incomplete").length,
      absent: records.filter((r) => r.status === "absent").length,
    }),
    [records]
  )

  const departmentOptions = useMemo(() => {
    const visibleDepartments = lockedDepartment ? [lockedDepartment] : departments
    return visibleDepartments.map((d) => ({ value: d, label: d }))
  }, [departments, lockedDepartment])

  const columns: DataTableColumn<AttendanceRecord>[] = [
    {
      key: "user_name",
      label: "Employee",
      sortable: true,
      accessor: (r) => r.user_name,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <StaffAvatar name={r.user_name} profileId={r.user_id} src={staffAvatars[r.user_id]} size="sm" />
          <div className="min-w-0">
            <div className="truncate font-medium">{r.user_name}</div>
            <div className="text-muted-foreground text-xs">{r.department}</div>
          </div>
        </div>
      ),
      resizable: true,
      initialWidth: 220,
    },
    {
      key: "clock_in",
      label: "Clock In",
      sortable: true,
      accessor: (r) => r.clock_in ?? "",
      render: (r) => {
        const isLateArrival =
          (r.status === "late" || r.status === "lateness_with_permission" || isLate(r.clock_in)) && r.status !== "early"
        return (
          <span className="flex items-center justify-center gap-1 text-sm">
            {r.clock_in ? (
              <>
                <Clock
                  className={cn(
                    "h-3 w-3 shrink-0",
                    isLateArrival ? "text-yellow-600 dark:text-yellow-500" : "text-green-600"
                  )}
                />
                <span>{formatTime(r.clock_in)}</span>
              </>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </span>
        )
      },
      align: "center",
    },
    {
      key: "clock_out",
      label: "Clock Out",
      sortable: true,
      accessor: (r) => r.clock_out ?? "",
      render: (r) => (
        <span className="flex items-center justify-center gap-1 text-sm">
          {r.clock_out ? (
            <>
              <Clock className="h-3 w-3 shrink-0 text-red-500" />
              <span>{formatTime(r.clock_out)}</span>
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </span>
      ),
      align: "center",
    },
    {
      key: "work_hours",
      label: "Work Hour",
      sortable: true,
      accessor: (r) => getHourBreakdown(r, policy).work ?? 0,
      render: (r) => {
        const { work } = getHourBreakdown(r, policy)
        return <span>{work != null ? `${work.toFixed(1)}h` : "—"}</span>
      },
      align: "center",
      hideOnMobile: true,
    },
    {
      key: "missed_hours",
      label: "Missed",
      sortable: true,
      accessor: (r) => getHourBreakdown(r, policy).missed ?? 0,
      render: (r) => {
        const { missed } = getHourBreakdown(r, policy)
        if (missed == null) return <span className="text-muted-foreground">—</span>
        return missed > 0 ? (
          <span className="text-orange-500">{missed.toFixed(1)}h</span>
        ) : (
          <span className="text-muted-foreground">0.0h</span>
        )
      },
      align: "center",
      hideOnMobile: true,
    },
    {
      key: "total_hours",
      label: "Total Hr",
      sortable: true,
      accessor: (r) => r.total_hours ?? 0,
      render: (r) => {
        const { total } = getHourBreakdown(r, policy)
        return <span>{total != null ? `${total.toFixed(1)}h` : "—"}</span>
      },
      align: "center",
      hideOnMobile: true,
    },
    {
      key: "overtime",
      label: "Over Time",
      sortable: true,
      accessor: (r) => getHourBreakdown(r, policy).overtime ?? 0,
      render: (r) => {
        const { overtime } = getHourBreakdown(r, policy)
        return overtime != null && overtime >= 0.05 ? (
          <span className="font-medium text-orange-600 dark:text-orange-400">+{overtime.toFixed(1)}h</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      },
      align: "center",
      hideOnMobile: true,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (r) => r.status,
      render: (r) => {
        const pendingBadge = r.pending_appeal ? getPendingAppealBadge(r.pending_appeal) : null
        return (
          <div className="flex flex-col items-center gap-1">
            <StatusBadge
              status={r.status}
              record={r}
              earlyClosure={r.early_closure_time ? { closeTime: r.early_closure_time } : null}
            />
            {pendingBadge && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className={`cursor-help px-1.5 py-0 text-xs ${pendingBadge.className}`}>
                    {pendingBadge.label}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">{pendingBadge.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )
      },
    },
    {
      key: "source",
      label: "Source",
      accessor: (r) => r.source ?? "",
      render: (r) => <span className="text-muted-foreground text-xs">{labelSource(r)}</span>,
      hideOnMobile: true,
    },
    {
      key: "actions",
      label: "Edit",
      render: (r) => (
        <Button aria-label="Edit" variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ]

  const tableFilters: DataTableFilter<AttendanceRecord>[] = [
    {
      // Chooses which day is loaded rather than filtering rows; lives in the
      // filter row like the Month filter on the Summary and Change log tabs.
      key: "date",
      label: "Date",
      options: [],
      mode: "custom",
      pinned: true,
      filterFn: () => true,
      // One control the same height, border and width as the dropdowns beside it,
      // so it sits in a single filter cell instead of spilling into the next.
      render: () => (
        <div className="border-input flex h-9 w-full items-center overflow-hidden rounded-md border shadow-sm">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-full w-8 shrink-0 rounded-none"
                onClick={() => shiftDate(-1)}
                aria-label="Previous day"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Previous day</TooltipContent>
          </Tooltip>
          <input
            type="date"
            value={rosterDate}
            max={toLocalISODate()}
            onChange={(e) => e.target.value && setRosterDate(e.target.value)}
            aria-label="Roster date"
            className="border-input h-full min-w-0 flex-1 border-x bg-transparent px-2 text-sm focus:outline-none"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-full w-8 shrink-0 rounded-none"
                onClick={() => shiftDate(1)}
                disabled={rosterDate >= toLocalISODate()}
                aria-label="Next day"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Next day</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="border-input h-full w-8 shrink-0 rounded-none border-l"
                onClick={() => void load()}
                disabled={refreshing || isFetching}
                aria-label="Refresh now"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", (refreshing || isFetching) && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isLive ? "Refresh now (also refreshes every 2 min)" : "Refresh"}
            </TooltipContent>
          </Tooltip>
        </div>
      ),
    },
    {
      key: "department",
      label: "Department",
      options: departmentOptions,
      placeholder: lockedDepartment || "All Departments",
    },
    {
      key: "status",
      label: "Status",
      options: [
        { value: "early", label: "Early" },
        { value: "present", label: "Present" },
        { value: "late", label: "Late" },
        { value: "lateness_with_permission", label: "LWP" },
        { value: "incomplete_with_permission", label: "IWP" },
        { value: "incomplete", label: "Incomplete" },
        { value: "absent", label: "Absent" },
        { value: "absent_with_permission", label: "AWP" },
        { value: "out_of_station", label: "OOS" },
        { value: "exempted", label: "Exempted" },
        { value: "cds", label: "CDS" },
        { value: "waiver", label: "Waiver" },
        { value: "on_leave", label: "On Leave" },
        { value: "holiday", label: "Holiday" },
      ],
      placeholder: "All Statuses",
    },
  ]

  const clockIn = editRecord?.clock_in ?? null
  const { isOnTimePresent, options: statusOptions } = getManualStatusEditOptions(editRecord)

  const hasManualComment = editForm.manual_comment.trim().length >= 3
  const hasPendingAppeal = Boolean(editRecord?.pending_appeal)
  const cannotSave = saving || !editForm.status || !hasManualComment || isOnTimePresent || hasPendingAppeal

  const todayIso = toLocalISODate()
  function shiftDate(deltaDays: number) {
    setRosterDate((prev) => {
      const d = new Date(`${prev}T00:00:00Z`)
      d.setUTCDate(d.getUTCDate() + deltaDays)
      const next = toLocalISODate(d)
      // Don't allow navigating into the future.
      return next > todayIso ? prev : next
    })
  }

  return (
    <>
      <StatGrid className="mb-4">
        <StatCard
          variant="compact"
          title="Present"
          value={stats.present}
          icon={Users}
          iconBgColor="bg-blue-500/10"
          iconColor="text-blue-500"
        />
        <StatCard
          variant="compact"
          title="Early"
          value={stats.early}
          icon={Users}
          iconBgColor="bg-green-500/10"
          iconColor="text-green-500"
        />
        <StatCard
          variant="compact"
          title="Late"
          value={stats.late}
          icon={Clock}
          iconBgColor="bg-yellow-500/10"
          iconColor="text-yellow-500"
        />
        <StatCard
          variant="compact"
          title="Absent"
          value={stats.absent}
          icon={AlertCircle}
          iconBgColor="bg-red-500/10"
          iconColor="text-red-500"
        />
        <StatCard
          variant="compact"
          title="Incomplete"
          value={stats.incomplete}
          icon={AlertCircle}
          iconBgColor="bg-cyan-500/10"
          iconColor="text-cyan-500"
        />
      </StatGrid>

      <DataTable<AttendanceRecord>
        data={orderedRecords}
        columns={columns}
        filters={tableFilters}
        getRowId={(r) => r.id}
        pagination={{ pageSize: 50 }}
        searchPlaceholder="Search employee or department…"
        searchFn={(r, q) => [r.user_name, r.department].join(" ").toLowerCase().includes(q)}
        isLoading={loading}
        viewToggle
        contactsView
        stickyToolbar
        defaultViewMode={{ mobile: "contacts", desktop: "list" }}
        mobileRow={{
          leading: (r) => (
            <StaffAvatar name={r.user_name} profileId={r.user_id} src={staffAvatars[r.user_id]} size="sm" />
          ),
          title: (r) => <NameWithDept name={r.user_name} code={deptCode(r.department)} />,
          subtitle: (r) => (
            <ClockTimes
              clockIn={r.clock_in}
              clockOut={r.clock_out}
              isLate={
                (r.status === "late" || r.status === "lateness_with_permission" || isLate(r.clock_in)) &&
                r.status !== "early"
              }
            />
          ),
          trailing: (r) => (
            <StatusBadge
              status={r.status}
              record={r}
              earlyClosure={r.early_closure_time ? { closeTime: r.early_closure_time } : null}
            />
          ),
          detail: {
            title: (r) => r.user_name,
            subtitle: (r) =>
              `${r.department} · ${formatWATDate(r.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}`,
            badges: (r) => (
              <StatusBadge
                status={r.status}
                record={r}
                earlyClosure={r.early_closure_time ? { closeTime: r.early_closure_time } : null}
              />
            ),
            fields: (r) => {
              const hours = getHourBreakdown(r)
              return [
                { icon: Building, label: "Department", value: r.department },
                {
                  icon: Calendar,
                  label: "Date",
                  value: formatWATDate(r.date, { day: "numeric", month: "short", year: "numeric" }),
                },
                { icon: Clock, label: "Clock In", value: formatTime(r.clock_in) },
                { icon: Clock, label: "Clock Out", value: formatTime(r.clock_out) },
                {
                  icon: Clock,
                  label: "Work Hours",
                  value: hours.work != null ? `${hours.work.toFixed(2)} hrs` : "-",
                },
                {
                  icon: AlertCircle,
                  label: "Missed Hours",
                  value: (hours.missed ?? 0) > 0 ? `${hours.missed!.toFixed(2)} hrs` : "0.00 hrs",
                  muted: (hours.missed ?? 0) === 0,
                },
                {
                  icon: Clock,
                  label: "Total Hours",
                  value: hours.total != null ? `${hours.total.toFixed(2)} hrs` : "-",
                },
                ...(hours.overtime && hours.overtime > 0
                  ? [{ icon: Clock, label: "Overtime", value: `${hours.overtime.toFixed(2)} hrs` }]
                  : []),
                ...(r.source ? [{ icon: FileText, label: "Source", value: labelSource(r.source) }] : []),
                ...(r.manual_comment ? [{ icon: MessageSquare, label: "Note", value: r.manual_comment }] : []),
              ]
            },
            actions: (r) => [
              {
                label: r.id.startsWith("missing-") ? "Add Record" : "Edit Record",
                icon: Pencil,
                onClick: () => openEdit(r),
              },
            ],
          },
        }}
        cardRenderer={(r) => (
          <div className="bg-card space-y-3 rounded-xl border p-4 text-xs transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold">{r.user_name}</p>
                <p className="text-muted-foreground text-xs">{r.department}</p>
              </div>
              <StatusBadge
                status={r.status}
                record={r}
                earlyClosure={r.early_closure_time ? { closeTime: r.early_closure_time } : null}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Clock In:</span> {formatTime(r.clock_in)}
              </div>
              <div>
                <span className="text-muted-foreground">Clock Out:</span> {formatTime(r.clock_out)}
              </div>
            </div>
          </div>
        )}
        emptyTitle="No records for this date"
        emptyDescription="No attendance records found for the selected date."
        emptyIcon={FileText}
      />

      <Dialog open={editRecord !== null} onOpenChange={(open) => !open && setEditRecord(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editRecord?.id.startsWith("missing-") ? "Add Attendance Record" : "Edit Attendance Record"}
            </DialogTitle>
            <DialogDescription>
              {editRecord?.user_name} — {rosterDate}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editRecord?.pending_appeal && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
                {editRecord.pending_appeal.stage === "pending_lead" &&
                editRecord.pending_appeal.initiated_by_role === "admin_manual"
                  ? "An alteration is currently awaiting Department Lead confirmation (Pending Lead)."
                  : editRecord.pending_appeal.stage === "pending_lead"
                    ? "An appeal is currently pending both Department Lead endorsement and Admin approval (Pending Both)."
                    : editRecord.pending_appeal.stage === "pending_admin"
                      ? "An appeal is awaiting Admin & HR final approval (Pending Admin)."
                      : "An alteration or appeal is already pending for this day."}{" "}
                Please review or manage it in the Appeals tab.
              </div>
            )}
            {isOnTimePresent ? (
              <p className="text-muted-foreground text-sm">
                This record is fully present and on-time. No overrides (LWP/AWP) are applicable.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value) => setEditForm((f) => ({ ...f, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status..." />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>
                    Comment <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={editForm.manual_comment}
                    onChange={(e) => setEditForm((f) => ({ ...f, manual_comment: e.target.value }))}
                    placeholder="Reason for this manual attendance change"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRecord(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={cannotSave}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
