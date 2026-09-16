import { PmsTablePage } from "@/app/admin/hr/pms/_components/pms-table-page"
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

    const formattedRecords = cycleRecords.map((record) => {
      const isToday = record.date === todayISO
      const inProgress = isToday && Boolean(record.clock_in) && !record.clock_out
      return {
        id: record.id || `rec-${record.date}`,
        date: formatWATDate(record.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
        clock_in: formatClockTime(record.clock_in),
        clock_out: inProgress ? "In progress" : formatClockTime(record.clock_out),
        total_hours:
          record.total_hours !== null ? `${record.total_hours.toFixed(2)} hrs` : inProgress ? "Pending" : "-",
        status: record.status || "unknown",
        rawStatus: record.status,
      }
    })

    const presentCount = cycleRecords.filter((r) => {
      const s = (r.status || "").toLowerCase()
      return s === "present" || s === "early" || s.includes("permission") || s === "on_leave"
    }).length
    const lateCount = cycleRecords.filter((r) => (r.status || "").toLowerCase() === "late").length
    const totalHours = cycleRecords.reduce((sum, r) => sum + (r.total_hours || 0), 0)
    const totalDays = cycleRecords.length
    const quarterScore = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : null

    let status = "On Target"
    if (quarterScore !== null) {
      if (quarterScore < 75) {
        status = "At Risk"
      } else if (quarterScore < 90) {
        status = "Needs Attention"
      }
    } else {
      status = "No Data"
    }

    const rawStatus = status.toLowerCase().replace(/\s+/g, "_")

    return {
      quarter: formatCycleLabel(cycle.name),
      score: formatPercent(quarterScore),
      present_tracked: `${presentCount} / ${totalDays} days`,
      total_hours: totalHours > 0 ? `${totalHours.toFixed(1)} hrs` : "-",
      lateness: lateCount > 0 ? `${lateCount} day${lateCount === 1 ? "" : "s"} late` : "None",
      status: status,
      __rawStatus: rawStatus,
      __attendanceRecords: formattedRecords,
    }
  })

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
        { label: "Score", value: formatPercent(score.attendance_score), tooltip: "Attendance Score" },
        { label: "Present Days", value: score.breakdown.attendance.present },
        { label: "Tracked Days", value: score.breakdown.attendance.total },
      ]}
      tableTitle="Attendance by Quarter"
      tableDescription={`Attendance scores for ${score.cycle_name || "all quarters"}. Expand any quarter to review daily clock-in details.`}
      rows={rows}
      columns={[
        { key: "quarter", label: "Quarter" },
        { key: "score", label: "Score" },
        { key: "present_tracked", label: "Present / Evaluated" },
        { key: "total_hours", label: "Total Hours" },
        { key: "lateness", label: "Lateness" },
        { key: "status", label: "Status" },
      ]}
      searchPlaceholder="Search quarter or score..."
      hideFirstColumnFilter
      hideSecondaryFilter
    />
  )
}
