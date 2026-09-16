import { PmsTablePage } from "@/app/admin/hr/pms/_components/pms-table-page"
import { computeAttendanceDay } from "@/lib/hr/attendance-ssot"
import { formatCycleLabel, matchesCadence } from "@/lib/pms/cadence"
import { formatWATDate, toLocalISODate } from "@/lib/utils/date"
import { getCurrentUserPmsData } from "../_lib"

function formatPercent(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value}%` : "-"
}

function formatClockTime(value: string | null | undefined): string {
  if (!value || value === "-") return "-"
  const parts = value.split(":")
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`
  }
  return value
}

export default async function PmsAttendancePage({ searchParams }: { searchParams: Promise<{ cycle_id?: string }> }) {
  const { cycle_id } = await searchParams
  const effectiveCycleId = cycle_id ?? "all"
  const { score, cycles, activeCycleId, attendance } = await getCurrentUserPmsData(effectiveCycleId)

  const todayISO = toLocalISODate()

  // Only include quarterly cycles (exclude biannual H1/H2 and annual FY)
  const quarterlyCycles = cycles.filter((c) => matchesCadence("quarterly", c.reviewType, c.name))

  // Filter cycles if a specific quarter cycle was requested in URL
  const targetCycles =
    effectiveCycleId && effectiveCycleId !== "all"
      ? quarterlyCycles.filter((c) => c.id === effectiveCycleId)
      : quarterlyCycles

  const rows = targetCycles.map((cycle) => {
    const cycleRecords = attendance.recent.filter((rec) => {
      if (!cycle.startDate || !cycle.endDate) return true
      return rec.date >= cycle.startDate && rec.date <= cycle.endDate
    })

    let totalWorkHours = 0
    let totalMissedHours = 0
    let presentCount = 0
    let lateCount = 0

    const formattedRecords = cycleRecords.map((record) => {
      const isToday = record.date === todayISO
      const inProgress = isToday && Boolean(record.clock_in) && !record.clock_out

      const dayResult = computeAttendanceDay({
        status: record.status || (record.clock_in ? "present" : "absent"),
        clockIn: record.clock_in,
        clockOut: record.clock_out,
        inProgress,
      })

      totalWorkHours += dayResult.hoursWorked
      totalMissedHours += dayResult.hoursLost
      if (dayResult.hoursWorked > 0 || dayResult.covered) {
        presentCount++
      }
      if (dayResult.lateBracket > 0) {
        lateCount++
      }

      return {
        id: record.id || `rec-${record.date}`,
        date: formatWATDate(record.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
        clock_in: formatClockTime(record.clock_in),
        clock_out: inProgress ? "In progress" : formatClockTime(record.clock_out),
        total_hours: inProgress ? "In progress" : `${dayResult.hoursWorked.toFixed(1)} hrs`,
        status: record.status || dayResult.status || "unknown",
        rawStatus: record.status,
      }
    })

    const totalDays = cycleRecords.length
    const quarterScore = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : null

    return {
      quarter: formatCycleLabel(cycle.name),
      score: formatPercent(quarterScore),
      present_tracked: `${presentCount} / ${totalDays} days`,
      total_work_hours: totalDays > 0 ? `${totalWorkHours.toFixed(1)} hrs` : "-",
      total_miss_hours: totalDays > 0 ? `${totalMissedHours.toFixed(1)} hrs` : "-",
      lateness: `${lateCount} / ${totalDays} days`,
      __presentCount: presentCount,
      __totalDays: totalDays,
      __attendanceRecords: formattedRecords,
    }
  })

  const sumPresent = rows.reduce((sum, r) => sum + r.__presentCount, 0)
  const sumTracked = rows.reduce((sum, r) => sum + r.__totalDays, 0)
  const avgScore = sumTracked > 0 ? Math.round((sumPresent / sumTracked) * 100) : null

  const summaryScore = effectiveCycleId !== "all" ? score.attendance_score : avgScore
  const summaryPresent = effectiveCycleId !== "all" ? score.breakdown.attendance.present : sumPresent
  const summaryTracked = effectiveCycleId !== "all" ? score.breakdown.attendance.total : sumTracked

  return (
    <PmsTablePage
      title="PMS Attendance"
      description="Track your attendance score and working hours by quarter. Expand any quarter row to inspect the daily clock-in punch logs."
      backHref="/pms"
      backLabel="Back to PMS"
      icon="attendance"
      cycles={cycles}
      activeCycleId={activeCycleId}
      summaryCards={[
        { label: "Score", value: formatPercent(summaryScore), tooltip: "Attendance Score" },
        { label: "Present Days", value: summaryPresent },
        { label: "Tracked Days", value: summaryTracked },
      ]}
      tableTitle="Attendance by Quarter"
      tableDescription={`Attendance scores for ${score.cycle_name || "all quarters"}. Expand any quarter to review daily clock-in details.`}
      rows={rows}
      columns={[
        { key: "quarter", label: "Quarter" },
        { key: "score", label: "Score" },
        { key: "present_tracked", label: "Present / Evaluated" },
        { key: "total_work_hours", label: "Total Work Hours" },
        { key: "total_miss_hours", label: "Total Miss Hours" },
        { key: "lateness", label: "Lateness" },
      ]}
      searchPlaceholder="Search quarter or score..."
      hideFirstColumnFilter
      hideSecondaryFilter
    />
  )
}
