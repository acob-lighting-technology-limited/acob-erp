"use client"

import { Loader2 } from "lucide-react"
import { StatusBadge, formatTime, labelSource } from "@/app/admin/hr/attendance/_components/status-badge"
import { useQuery } from "@tanstack/react-query"
import { apiJson } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"

type AttendanceDay = {
  date: string
  record?: {
    id: string
    date: string
    clock_in: string | null
    clock_out: string | null
    status: string
    source: string | null
    clock_in_source: string | null
    clock_out_source: string | null
    waived: boolean
    editor_first_name?: string | null
  } | null
  status: string
  manual_by: string | null
}

function getMonthsInRange(startDateStr: string, endDateStr: string): string[] {
  const start = new Date(startDateStr)
  const end = new Date(endDateStr)
  const months: string[] = []

  const current = new Date(start.getFullYear(), start.getMonth(), 1)
  const endMonthLimit = new Date(end.getFullYear(), end.getMonth(), 1)

  while (current <= endMonthLimit) {
    const year = current.getFullYear()
    const month = String(current.getMonth() + 1).padStart(2, "0")
    months.push(`${year}-${month}`)
    current.setMonth(current.getMonth() + 1)
  }

  return months
}

export function IndividualAttendanceExpandedRow({
  userId,
  cycleId,
  cycles,
}: {
  userId: string
  cycleId: string
  cycles: { id: string; name: string; start_date: string | null; end_date: string | null }[]
}) {
  const cycle = cycles.find((c) => c.id === cycleId)
  const startDate = cycle?.start_date
  const endDate = cycle?.end_date

  const {
    data: days = [],
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: QUERY_KEYS.employeeCycleAttendance(userId, startDate ?? "", endDate ?? ""),
    enabled: Boolean(userId && startDate && endDate),
    queryFn: async () => {
      const months = getMonthsInRange(startDate!, endDate!)
      const results = await Promise.all(
        months.map(async (month) => {
          const payload = await apiJson<{ data?: AttendanceDay[] }>(
            `/api/admin/hr/attendance/employee-days?user_id=${encodeURIComponent(userId)}&year_month=${encodeURIComponent(month)}`,
            { cache: "no-store" }
          )
          return payload.data || []
        })
      )
      // Merge all months, keep the cycle range, newest first.
      return results
        .flat()
        .filter((d) => d.date >= startDate! && d.date <= endDate!)
        .sort((a, b) => b.date.localeCompare(a.date))
    },
  })
  const error = queryError?.message ?? null

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-4 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading daily attendance logs...
      </div>
    )
  }

  if (error) {
    return <div className="text-destructive py-2 text-sm">Error: {error}</div>
  }

  if (days.length === 0) {
    return <div className="text-muted-foreground py-2 text-sm">No attendance logs found in this cycle.</div>
  }

  return (
    <div className="space-y-2">
      <div className="text-muted-foreground text-xs font-semibold">Daily Attendance logs for {cycle?.name}</div>
      <div className="bg-card overflow-x-auto rounded-md border">
        <table className="w-full min-w-150 text-sm">
          <thead className="bg-muted/50 text-muted-foreground font-medium">
            <tr>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-left">Clock In</th>
              <th className="px-4 py-2 text-left">Clock Out</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Source/Captured By</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const rec = day.record
              return (
                <tr key={day.date} className="hover:bg-muted/30 border-t transition-colors">
                  <td className="px-4 py-2 font-medium">{day.date}</td>
                  <td className="px-4 py-2">{formatTime(rec?.clock_in)}</td>
                  <td className="px-4 py-2">{formatTime(rec?.clock_out)}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={day.status} waived={rec?.waived} record={rec} recordDate={day.date} />
                  </td>
                  <td className="text-muted-foreground px-4 py-2 text-xs">{labelSource(rec)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
