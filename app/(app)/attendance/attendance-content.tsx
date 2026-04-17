"use client"

import { useMemo, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { Clock, LogIn, LogOut } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import type { AttendanceRecord } from "./page"
import { logger } from "@/lib/logger"

const log = logger("dashboard-attendance-attendance-content")

interface AttendanceContentProps {
  initialTodayRecord: AttendanceRecord | null
  initialRecentRecords: AttendanceRecord[]
}

type AttendanceRow = AttendanceRecord & {
  dateLabel: string
  periodLabel: string
  monthLabel: string
}

export function AttendanceContent({ initialTodayRecord, initialRecentRecords }: AttendanceContentProps) {
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(initialTodayRecord)
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>(initialRecentRecords)
  const [actionLoading, setActionLoading] = useState(false)
  const { toast } = useToast()

  async function fetchAttendanceData() {
    try {
      const response = await fetch("/api/hr/attendance/records")
      const data = await response.json()
      if (response.ok && data.data) {
        const today = new Date().toISOString().split("T")[0]
        const todayRec = data.data.find((record: AttendanceRecord) => record.date === today)
        setTodayRecord(todayRec || null)
        setRecentRecords(data.data.slice(0, 30))
      }
    } catch (error) {
      log.error("Error fetching attendance:", error)
    }
  }

  async function handleClockIn() {
    setActionLoading(true)
    try {
      const response = await fetch("/api/hr/attendance/clock-in", { method: "POST" })
      const data = await response.json()
      if (response.ok) {
        toast({ title: "Success", description: "Clocked in successfully" })
        await fetchAttendanceData()
      } else {
        toast({ title: "Error", description: data.error || "Failed to clock in", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "An error occurred", variant: "destructive" })
    } finally {
      setActionLoading(false)
    }
  }

  async function handleClockOut() {
    setActionLoading(true)
    try {
      const response = await fetch("/api/hr/attendance/clock-out", { method: "POST" })
      const data = await response.json()
      if (response.ok) {
        toast({ title: "Success", description: "Clocked out successfully" })
        await fetchAttendanceData()
      } else {
        toast({ title: "Error", description: data.error || "Failed to clock out", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "An error occurred", variant: "destructive" })
    } finally {
      setActionLoading(false)
    }
  }

  const rows = useMemo<AttendanceRow[]>(
    () =>
      recentRecords.map((record) => {
        const date = new Date(record.date)
        return {
          ...record,
          dateLabel: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          periodLabel: `${record.clock_in} - ${record.clock_out || "In Progress"}`,
          monthLabel: date.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
        }
      }),
    [recentRecords]
  )

  const columns = useMemo<DataTableColumn<AttendanceRow>[]>(
    () => [
      {
        key: "date",
        label: "Date",
        sortable: true,
        accessor: (row) => row.date,
        render: (row) => <span className="font-medium">{row.dateLabel}</span>,
      },
      {
        key: "period",
        label: "Clock Period",
        sortable: true,
        accessor: (row) => row.periodLabel,
      },
      {
        key: "total_hours",
        label: "Total Hours",
        sortable: true,
        accessor: (row) => row.total_hours || 0,
        render: (row) => (row.total_hours ? `${row.total_hours.toFixed(2)} hrs` : "Pending"),
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        accessor: (row) => row.status,
        render: (row) => <Badge variant="outline">{row.status || "In Progress"}</Badge>,
      },
    ],
    []
  )

  const filters = useMemo<DataTableFilter<AttendanceRow>[]>(
    () => [
      {
        key: "status",
        label: "Status",
        options: Array.from(new Set(rows.map((row) => row.status))).map((status) => ({
          value: status,
          label: status,
        })),
      },
      {
        key: "month",
        label: "Month",
        mode: "custom",
        options: Array.from(new Set(rows.map((row) => row.monthLabel))).map((month) => ({
          value: month,
          label: month,
        })),
        filterFn: (row, selected) => selected.includes(row.monthLabel),
      },
    ],
    [rows]
  )

  const todayHours = todayRecord?.total_hours ? `${todayRecord.total_hours.toFixed(2)} hrs` : "Pending"
  const todayStatus = todayRecord?.status || "Not clocked in"

  return (
    <DataTablePage
      title="Attendance"
      description="Track your work hours and attendance records."
      icon={Clock}
      backLink={{ href: "/profile", label: "Back to Dashboard" }}
      actions={
        todayRecord && !todayRecord.clock_out ? (
          <Button onClick={handleClockOut} disabled={actionLoading} className="gap-2">
            <LogOut className="h-4 w-4" />
            Clock Out
          </Button>
        ) : (
          <Button onClick={handleClockIn} disabled={actionLoading} className="gap-2">
            <LogIn className="h-4 w-4" />
            Clock In
          </Button>
        )
      }
      stats={
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            title="Today Status"
            value={todayStatus}
            icon={Clock}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            title="Today Hours"
            value={todayHours}
            icon={Clock}
            iconBgColor="bg-emerald-500/10"
            iconColor="text-emerald-500"
          />
          <StatCard
            title="Records (30d)"
            value={rows.length}
            icon={Clock}
            iconBgColor="bg-amber-500/10"
            iconColor="text-amber-500"
          />
        </div>
      }
    >
      <DataTable<AttendanceRow>
        data={rows}
        columns={columns}
        filters={filters}
        getRowId={(row) => row.id}
        searchPlaceholder="Search date, clock period, or status..."
        searchFn={(row, query) => `${row.dateLabel} ${row.periodLabel} ${row.status}`.toLowerCase().includes(query)}
        emptyTitle="No attendance records"
        emptyDescription="No records are available yet."
        emptyIcon={Clock}
        skeletonRows={6}
        urlSync
      />
    </DataTablePage>
  )
}
