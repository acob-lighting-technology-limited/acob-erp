"use client"

import { useCallback, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StaffAvatar } from "@/components/ui/staff-avatar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  Edit2,
  FileSignature,
  KeyRound,
  Laptop,
  Palmtree,
  QrCode,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  XCircle,
} from "lucide-react"
import { getCurrentOfficeWeek } from "@/lib/meeting-week"
import { AttendanceStatsGrid } from "./_components/attendance-stats"
import { AttendancePrintSheetDialog } from "./_components/attendance-print-sheet"
import { AttendanceEditDialog } from "./_components/attendance-edit-dialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { AttendanceRosterItem } from "@/app/api/reports/general-meeting/attendance/route"

function formatTime(isoString: string | null): string {
  if (!isoString) return "—"
  try {
    const d = new Date(isoString)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })
  } catch {
    return isoString
  }
}

export default function AdminMeetingAttendancePage() {
  const currentWeek = useMemo(() => getCurrentOfficeWeek(), [])
  const [week, setWeek] = useState(currentWeek.week)
  const [year, setYear] = useState(currentWeek.year)
  const [showPrintSheet, setShowPrintSheet] = useState(false)
  const [editingItem, setEditingItem] = useState<AttendanceRosterItem | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  // 1. Fetch meeting session (contains 6-digit code, active state, holiday info)
  const {
    data: sessionData,
    refetch: refetchSession,
    isLoading: sessionLoading,
  } = useQuery({
    queryKey: ["general-meeting-session", week, year],
    queryFn: async () => {
      const res = await fetch(`/api/reports/general-meeting/attendance/session?week=${week}&year=${year}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load meeting session")
      return json
    },
  })

  // 2. Fetch attendance roster + stats
  const {
    data: attendanceData,
    refetch: refetchAttendance,
    isLoading: attendanceLoading,
    error: attendanceError,
  } = useQuery({
    queryKey: ["general-meeting-attendance", week, year],
    queryFn: async () => {
      const res = await fetch(`/api/reports/general-meeting/attendance?week=${week}&year=${year}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load attendance roster")
      return json as {
        meetingDate: string
        items: AttendanceRosterItem[]
        stats: {
          totalStaff: number
          officeClockedIn: number
          meetingPresent: number
          officeNotScanned: number
          onLeave: number
          absent: number
        }
      }
    },
  })

  const session = sessionData?.session
  const holidayInfo = sessionData?.holidayInfo
  const items = useMemo(() => attendanceData?.items || [], [attendanceData?.items])
  const stats = attendanceData?.stats || {
    totalStaff: 0,
    officeClockedIn: 0,
    meetingPresent: 0,
    officeNotScanned: 0,
    onLeave: 0,
    absent: 0,
  }

  // Extract departments for filter dropdown
  const departments = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.department).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [items])

  // 1-Click "Confirm in Room" action
  const handleQuickConfirm = useCallback(
    async (item: AttendanceRosterItem) => {
      setConfirmingId(item.id)
      try {
        const res = await fetch("/api/reports/general-meeting/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            week,
            year,
            userId: item.id,
            action: "confirm_in_room",
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to confirm attendance")

        toast.success(`Confirmed ${item.full_name} in conference room!`)
        await refetchAttendance()
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Error confirming in room")
      } finally {
        setConfirmingId(null)
      }
    },
    [week, year, refetchAttendance]
  )

  // Export Roster to CSV
  const handleExportCsv = () => {
    if (items.length === 0) {
      toast.error("No data to export")
      return
    }

    const headers = [
      "Staff Name",
      "Department",
      "Designation",
      "Office Entrance Punch",
      "Meeting Check-In",
      "Status",
      "Mode",
      "Source",
      "Manual Comment",
    ]
    const rows = items.map((i) => [
      `"${i.full_name.replace(/"/g, '""')}"`,
      `"${i.department.replace(/"/g, '""')}"`,
      `"${(i.designation || "").replace(/"/g, '""')}"`,
      `"${i.office_clock_in || "No Punch"}"`,
      `"${i.meeting_clock_in || "Not Checked In"}"`,
      `"${i.status}"`,
      `"${i.attendance_mode || "physical"}"`,
      `"${i.source || "—"}"`,
      `"${(i.manual_comment || "").replace(/"/g, '""')}"`,
    ])

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `General_Meeting_Attendance_W${week}_${year}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success("Exported attendance roster to CSV")
  }

  const columns = useMemo<DataTableColumn<AttendanceRosterItem>[]>(
    () => [
      {
        key: "employee",
        label: "Employee",
        sortable: true,
        accessor: (r) => r.full_name,
        render: (r) => (
          <div className="flex items-center gap-3 py-1">
            <StaffAvatar name={r.full_name} src={r.avatar_url} size="md" />
            <div className="min-w-0">
              <div className="text-foreground truncate font-medium">{r.full_name}</div>
              <div className="text-muted-foreground truncate text-xs">{r.designation || r.department}</div>
            </div>
          </div>
        ),
        initialWidth: 260,
      },
      {
        key: "department",
        label: "Department",
        sortable: true,
        accessor: (r) => r.department,
        render: (r) => <span className="text-muted-foreground text-xs font-medium">{r.department}</span>,
        initialWidth: 160,
      },
      {
        key: "office_clock_in",
        label: "Office Entrance Punch",
        sortable: true,
        accessor: (r) => r.office_clock_in || "",
        render: (r) => {
          if (!r.office_clock_in) {
            return <span className="text-muted-foreground text-xs italic">No punch</span>
          }
          return (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-foreground text-xs font-semibold">{formatTime(r.office_clock_in)}</span>
              <Badge
                variant="outline"
                className="border-muted-foreground/30 text-muted-foreground px-1 py-0 text-[10px] uppercase"
              >
                {r.office_clock_in_source || "Bio"}
              </Badge>
            </div>
          )
        },
        initialWidth: 180,
      },
      {
        key: "meeting_clock_in",
        label: "Meeting Check-In",
        sortable: true,
        accessor: (r) => r.meeting_clock_in || "",
        render: (r) => {
          if (!r.meeting_clock_in) {
            if (r.office_clock_in && !r.is_on_leave) {
              return (
                <Badge
                  variant="outline"
                  className="gap-1 border-amber-400/50 bg-amber-500/10 text-[11px] text-amber-700 dark:text-amber-400"
                >
                  <AlertTriangle className="h-3 w-3" /> Missed scan
                </Badge>
              )
            }
            return <span className="text-muted-foreground text-xs italic">—</span>
          }
          return (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-foreground text-xs font-semibold">{formatTime(r.meeting_clock_in)}</span>
            </div>
          )
        },
        initialWidth: 160,
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        accessor: (r) => r.status,
        render: (r) => {
          if (r.is_on_leave) {
            return (
              <Badge variant="outline" className="gap-1 border-sky-400/50 bg-sky-500/10 text-sky-700 dark:text-sky-400">
                <Palmtree className="h-3 w-3" /> On Leave
              </Badge>
            )
          }
          switch (r.status) {
            case "present":
              return (
                <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> Present
                </Badge>
              )
            case "late":
              return (
                <Badge className="gap-1 bg-amber-600 text-white hover:bg-amber-600">
                  <Clock className="h-3 w-3" /> Late
                </Badge>
              )
            case "excused":
              return (
                <Badge variant="secondary" className="gap-1">
                  <ShieldCheck className="h-3 w-3" /> Excused
                </Badge>
              )
            case "absent":
              return (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" /> Absent
                </Badge>
              )
            default:
              return (
                <Badge variant="outline" className="text-muted-foreground">
                  Unrecorded
                </Badge>
              )
          }
        },
        initialWidth: 130,
      },
      {
        key: "source",
        label: "Source / Mode",
        sortable: true,
        accessor: (r) => r.source || "",
        render: (r) => {
          if (!r.source && !r.attendance_mode) return <span className="text-muted-foreground text-xs">—</span>
          if (r.attendance_mode === "virtual") {
            return (
              <Badge
                variant="outline"
                className="gap-1 border-sky-400/50 bg-sky-500/10 text-[11px] text-sky-700 dark:text-sky-400"
              >
                <Laptop className="h-3 w-3" /> Online
              </Badge>
            )
          }
          switch (r.source) {
            case "qr_scan":
              return (
                <Badge
                  variant="outline"
                  className="gap-1 border-indigo-400/50 bg-indigo-500/10 text-[11px] text-indigo-700 dark:text-indigo-400"
                >
                  <QrCode className="h-3 w-3" /> QR Scan
                </Badge>
              )
            case "code_input":
              return (
                <Badge
                  variant="outline"
                  className="gap-1 border-violet-400/50 bg-violet-500/10 text-[11px] text-violet-700 dark:text-violet-400"
                >
                  <KeyRound className="h-3 w-3" /> 6-Digit Code
                </Badge>
              )
            case "manual":
              return (
                <Badge
                  variant="outline"
                  className="gap-1 border-slate-400/50 bg-slate-500/10 text-[11px] text-slate-700 dark:text-slate-300"
                >
                  <FileSignature className="h-3 w-3" /> Manual
                </Badge>
              )
            default:
              return <span className="text-muted-foreground text-xs">{r.source}</span>
          }
        },
        initialWidth: 140,
      },
      {
        key: "actions",
        label: "Actions",
        render: (r) => (
          <div className="flex items-center gap-1.5">
            {r.office_clock_in && !r.meeting_clock_in && !r.is_on_leave && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleQuickConfirm(r)}
                    disabled={confirmingId === r.id}
                    className="h-7 border-emerald-500/40 bg-emerald-50 px-2 text-xs text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                    Confirm in Room
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Employee clocked into building today. Confirm they are seated in conference room.
                </TooltipContent>
              </Tooltip>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditingItem(r)}
              className="text-muted-foreground hover:text-foreground h-7 w-7 p-0"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
        initialWidth: 160,
      },
    ],
    [confirmingId, handleQuickConfirm]
  )

  const filters = useMemo<DataTableFilter<AttendanceRosterItem>[]>(
    () => [
      {
        key: "week_number",
        label: "Week",
        options: Array.from({ length: 53 }, (_, index) => {
          const w = index + 1
          return { value: String(w), label: `Week ${w}` }
        }),
        multi: false,
        placeholder: `Week ${week}`,
        mode: "custom",
        filterFn: () => true,
      },
      {
        key: "year",
        label: "Year",
        options: [currentWeek.year - 1, currentWeek.year, currentWeek.year + 1].map((y) => ({
          value: String(y),
          label: String(y),
        })),
        multi: false,
        placeholder: String(year),
        mode: "custom",
        filterFn: () => true,
      },
      {
        key: "department",
        label: "Department",
        options: departments.map((d) => ({ value: d, label: d })),
      },
      {
        key: "status",
        label: "Status",
        options: [
          { value: "present", label: "Present" },
          { value: "late", label: "Late" },
          { value: "excused", label: "Excused" },
          { value: "absent", label: "Absent" },
          { value: "on_leave", label: "On Leave" },
          { value: "unrecorded", label: "Unrecorded" },
        ],
      },
    ],
    [currentWeek.year, departments, week, year]
  )

  return (
    <DataTablePage
      title="General Meeting Attendance"
      description="Real-time biometric-verified attendance tracking for General Meeting & KSS."
      icon={UserCheck}
      backLink={{ href: "/admin/reports/general-meeting", label: "Back to General Meeting" }}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowPrintSheet(true)}>
            <QrCode className="h-3.5 w-3.5 text-indigo-600" />
            <span>Sign-In Sheet</span>
          </Button>

          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleExportCsv}>
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => {
              refetchSession()
              refetchAttendance()
            }}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", (attendanceLoading || sessionLoading) && "animate-spin")} />
          </Button>
        </div>
      }
      stats={
        <div className="space-y-3">
          {holidayInfo?.isMondayHoliday && (
            <div className="flex items-center gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="flex-1">
                <span className="font-semibold">Public Holiday Notice: </span>
                <span>{holidayInfo.mondayHolidayName} falls on Monday of this week.</span>
              </div>
            </div>
          )}
          <AttendanceStatsGrid stats={stats} />
        </div>
      }
    >
      <DataTable<AttendanceRosterItem>
        data={items}
        columns={columns}
        getRowId={(r) => r.id}
        searchPlaceholder="Search staff by name, department, or designation..."
        searchFn={(row, query) => {
          const q = query.toLowerCase()
          return (
            row.full_name.toLowerCase().includes(q) ||
            row.department.toLowerCase().includes(q) ||
            (row.designation?.toLowerCase().includes(q) ?? false)
          )
        }}
        filters={filters}
        onFilterChange={(filterValues) => {
          const weekValue = filterValues.week_number?.[0]
          const yearValue = filterValues.year?.[0]

          if (weekValue) {
            const parsedWeek = Number(weekValue)
            if (!Number.isNaN(parsedWeek) && parsedWeek !== week) {
              setWeek(parsedWeek)
            }
          }

          if (yearValue) {
            const parsedYear = Number(yearValue)
            if (!Number.isNaN(parsedYear) && parsedYear !== year) {
              setYear(parsedYear)
            }
          }
        }}
        isLoading={attendanceLoading}
        error={attendanceError instanceof Error ? attendanceError.message : null}
        onRetry={() => {
          refetchSession()
          refetchAttendance()
        }}
        pagination={{ pageSize: 50 }}
        viewToggle
        contactsView
        defaultViewMode={{ mobile: "contacts", desktop: "list" }}
        mobileRow={{
          leading: (r) => <StaffAvatar name={r.full_name} src={r.avatar_url} size="md" />,
          title: (r) => r.full_name,
          subtitle: (r) => [r.designation, r.department].filter(Boolean).join(" · ") || "—",
          trailing: (r) => {
            if (r.is_on_leave) {
              return (
                <Badge
                  variant="outline"
                  className="gap-1 border-sky-400/50 bg-sky-500/10 text-[10px] text-sky-700 dark:text-sky-400"
                >
                  <Palmtree className="h-2.5 w-2.5" /> Leave
                </Badge>
              )
            }
            if (r.meeting_clock_in) {
              return (
                <Badge className="gap-1 bg-emerald-600 text-[10px] text-white hover:bg-emerald-600">
                  <CheckCircle2 className="h-2.5 w-2.5" /> In Room
                </Badge>
              )
            }
            if (r.office_clock_in) {
              return (
                <Badge
                  variant="outline"
                  className="gap-1 border-amber-400/50 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400"
                >
                  <AlertTriangle className="h-2.5 w-2.5" /> Missed
                </Badge>
              )
            }
            return (
              <Badge variant="outline" className="text-muted-foreground text-[10px]">
                Unrecorded
              </Badge>
            )
          },
          detail: {
            title: (r) => r.full_name,
            subtitle: (r) => [r.designation, r.department].filter(Boolean).join(" · ") || "—",
            avatar: (r) => <StaffAvatar name={r.full_name} src={r.avatar_url} size="xl" />,
            fields: (r) => [
              { icon: Building2, label: "Department", value: r.department },
              {
                icon: Clock,
                label: "Entrance Punch",
                value: r.office_clock_in
                  ? `${formatTime(r.office_clock_in)} (${r.office_clock_in_source || "Bio"})`
                  : "No punch",
              },
              {
                icon: CheckCircle2,
                label: "Meeting Check-In",
                value: r.meeting_clock_in
                  ? `${formatTime(r.meeting_clock_in)} (${r.source || "QR"})`
                  : "Not checked in",
              },
              {
                icon: ShieldCheck,
                label: "Status",
                value: r.is_on_leave ? "On Leave" : r.status,
              },
              ...(r.manual_comment ? [{ icon: FileSignature, label: "Comment", value: r.manual_comment }] : []),
            ],
            actions: (r) => [
              ...(r.office_clock_in && !r.meeting_clock_in && !r.is_on_leave
                ? [
                    {
                      label: "Confirm in Room",
                      icon: CheckCircle2,
                      onClick: () => handleQuickConfirm(r),
                    },
                  ]
                : []),
              {
                label: "Edit Attendance",
                icon: Edit2,
                onClick: () => setEditingItem(r),
                variant: "outline" as const,
              },
            ],
          },
        }}
        cardRenderer={(r) => (
          <div className="group bg-card text-card-foreground border-border/60 hover:border-primary/40 space-y-3 rounded-xl border p-4 shadow-sm transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <StaffAvatar name={r.full_name} src={r.avatar_url} size="lg" />
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.full_name}</div>
                  <div className="text-muted-foreground truncate text-xs">{r.designation || r.department}</div>
                </div>
              </div>
              <Badge variant="outline" className="shrink-0 text-xs">
                {r.department}
              </Badge>
            </div>

            <div className="grid gap-2 border-t pt-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-blue-500" />
                  Office Punch:
                </span>
                {r.office_clock_in ? (
                  <div className="flex items-center gap-1 font-semibold">
                    <span>{formatTime(r.office_clock_in)}</span>
                    <Badge variant="outline" className="px-1 py-0 text-[10px] uppercase">
                      {r.office_clock_in_source || "Bio"}
                    </Badge>
                  </div>
                ) : (
                  <span className="text-muted-foreground italic">No punch</span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Meeting Check-In:
                </span>
                {r.meeting_clock_in ? (
                  <div className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    <span>{formatTime(r.meeting_clock_in)}</span>
                    {r.source && (
                      <Badge variant="outline" className="px-1 py-0 text-[10px]">
                        {r.source === "qr_scan" ? "QR" : r.source === "code_input" ? "Code" : r.source}
                      </Badge>
                    )}
                  </div>
                ) : r.office_clock_in && !r.is_on_leave ? (
                  <Badge
                    variant="outline"
                    className="gap-1 border-amber-400/50 bg-amber-500/10 text-[11px] text-amber-700 dark:text-amber-400"
                  >
                    <AlertTriangle className="h-3 w-3" /> Missed scan
                  </Badge>
                ) : (
                  <span className="text-muted-foreground italic">—</span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status:</span>
                {r.is_on_leave ? (
                  <Badge
                    variant="outline"
                    className="gap-1 border-sky-400/50 bg-sky-500/10 text-[11px] text-sky-700 dark:text-sky-400"
                  >
                    <Palmtree className="h-3 w-3" /> On Leave
                  </Badge>
                ) : r.status === "present" ? (
                  <Badge className="gap-1 bg-emerald-600 text-xs text-white hover:bg-emerald-600">
                    <CheckCircle2 className="h-3 w-3" /> Present
                  </Badge>
                ) : r.status === "late" ? (
                  <Badge className="gap-1 bg-amber-600 text-xs text-white hover:bg-amber-600">
                    <Clock className="h-3 w-3" /> Late
                  </Badge>
                ) : r.status === "excused" ? (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <ShieldCheck className="h-3 w-3" /> Excused
                  </Badge>
                ) : r.status === "absent" ? (
                  <Badge variant="destructive" className="gap-1 text-xs">
                    <XCircle className="h-3 w-3" /> Absent
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground text-xs">
                    Unrecorded
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-2">
              {r.office_clock_in && !r.meeting_clock_in && !r.is_on_leave && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickConfirm(r)}
                  disabled={confirmingId === r.id}
                  className="h-7 border-emerald-500/40 bg-emerald-50 px-2 text-xs text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                  Confirm in Room
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingItem(r)}
                className="text-muted-foreground hover:text-foreground h-7 w-7 p-0"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      />

      {session && (
        <AttendancePrintSheetDialog
          open={showPrintSheet}
          onOpenChange={setShowPrintSheet}
          week={week}
          year={year}
          meetingDate={session.meeting_date}
          code6Digit={session.code_6_digit}
          isHoliday={holidayInfo?.isMeetingDayHoliday}
          holidayName={holidayInfo?.meetingHolidayName}
        />
      )}

      <AttendanceEditDialog
        open={Boolean(editingItem)}
        onOpenChange={(open) => !open && setEditingItem(null)}
        item={editingItem}
        week={week}
        year={year}
        onSuccess={refetchAttendance}
      />
    </DataTablePage>
  )
}
