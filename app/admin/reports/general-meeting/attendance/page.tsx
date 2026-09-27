"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { PageHeader, PageWrapper } from "@/components/layout"
import { PageSection } from "@/components/ui/patterns"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, Calendar, Download, QrCode, RefreshCw, UserCheck } from "lucide-react"
import { getCurrentOfficeWeek } from "@/lib/meeting-week"
import { AttendanceStatsGrid } from "./_components/attendance-stats"
import { AttendanceTable } from "./_components/attendance-table"
import { AttendancePrintSheetDialog } from "./_components/attendance-print-sheet"
import { toast } from "sonner"
import type { AttendanceRosterItem } from "@/app/api/reports/general-meeting/attendance/route"

export default function AdminMeetingAttendancePage() {
  const currentWeek = useMemo(() => getCurrentOfficeWeek(), [])
  const [week, setWeek] = useState(currentWeek.week)
  const [year, setYear] = useState(currentWeek.year)
  const [showPrintSheet, setShowPrintSheet] = useState(false)

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
  const items = attendanceData?.items || []
  const stats = attendanceData?.stats || {
    totalStaff: 0,
    officeClockedIn: 0,
    meetingPresent: 0,
    officeNotScanned: 0,
    onLeave: 0,
    absent: 0,
  }

  const weekOptions = useMemo(() => Array.from({ length: 53 }, (_, i) => i + 1), [])
  const yearOptions = useMemo(() => [currentWeek.year - 1, currentWeek.year, currentWeek.year + 1], [currentWeek.year])

  const handleRegenerateCode = async () => {
    const res = await fetch("/api/reports/general-meeting/attendance/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        week,
        year,
        action: "regenerate_code",
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Failed to regenerate code")
    await refetchSession()
  }

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

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="General Meeting Attendance"
        description="Replace pen and paper with real-time biometric-verified QR & 6-digit attendance check-in."
        icon={UserCheck}
        backLink={{ href: "/admin/reports/general-meeting", label: "Back to General Meeting" }}
      />

      <div className="space-y-6">
        {/* Top Controls Bar: Week/Year Selector + Sheet & Export Buttons */}
        <div className="bg-card flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="text-muted-foreground h-4 w-4" />
              <span className="text-foreground text-xs font-semibold">Week:</span>
              <Select value={String(week)} onValueChange={(v) => setWeek(Number(v))}>
                <SelectTrigger className="h-8 w-24 text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {weekOptions.map((w) => (
                    <SelectItem key={w} value={String(w)} className="text-xs">
                      Week {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-foreground text-xs font-semibold">Year:</span>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="h-8 w-24 text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)} className="text-xs">
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                refetchSession()
                refetchAttendance()
              }}
              disabled={attendanceLoading}
              className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs"
            >
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${attendanceLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          <div className="flex items-center gap-2.5">
            <Button size="sm" variant="outline" onClick={handleExportCsv} className="h-8 gap-1.5 text-xs font-medium">
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>

            <Button
              size="sm"
              onClick={() => setShowPrintSheet(true)}
              className="h-8 gap-1.5 bg-indigo-600 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              <QrCode className="h-3.5 w-3.5" />
              Print / Download Sign-In Sheet
            </Button>
          </div>
        </div>

        {/* Dynamic Holiday Warning Banner */}
        {holidayInfo?.isMondayHoliday && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-500/10 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-0.5">
              <h4 className="text-sm font-semibold">Monday is a Public Holiday ({holidayInfo.mondayHolidayName})</h4>
              <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                General Meeting & KSS is dynamically aligned for this week. Scheduled meeting date:{" "}
                <span className="font-semibold underline">{holidayInfo.meetingDate}</span>.
              </p>
            </div>
          </div>
        )}

        {/* Real-time Stats Grid */}
        <AttendanceStatsGrid stats={stats} />

        {/* Directory-style Attendance Table */}
        <PageSection title="Staff Attendance Roster">
          <AttendanceTable
            items={items}
            week={week}
            year={year}
            isLoading={attendanceLoading || sessionLoading}
            onRefresh={refetchAttendance}
          />
        </PageSection>
      </div>

      {/* Printable Sheet Dialog */}
      <AttendancePrintSheetDialog
        open={showPrintSheet}
        onOpenChange={setShowPrintSheet}
        week={week}
        year={year}
        meetingDate={session?.meeting_date || attendanceData?.meetingDate || ""}
        code6Digit={session?.code_6_digit || "000000"}
        isHoliday={holidayInfo?.isMondayHoliday || holidayInfo?.isMeetingDayHoliday}
        holidayName={holidayInfo?.mondayHolidayName || holidayInfo?.meetingHolidayName}
        onRegenerateCode={handleRegenerateCode}
      />
    </PageWrapper>
  )
}
