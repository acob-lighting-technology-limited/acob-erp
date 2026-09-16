import { PmsTablePage } from "@/app/admin/hr/pms/_components/pms-table-page"
import { getCadenceType } from "@/lib/pms/cadence"
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

  const activeCycle = cycles.find((c) => c.id === activeCycleId)
  const cadence = getCadenceType(activeCycle?.reviewType, activeCycle?.name)
  const cycleColumnLabel = cadence === "biannual" || cadence === "annual" ? "Quarter" : "Cycle"

  const getCycleLabel = (dateValue: string) => {
    const date = new Date(dateValue)
    const year = date.getFullYear()
    const quarter = Math.floor(date.getMonth() / 3) + 1
    return `Q${quarter} ${year}`
  }

  const todayISO = toLocalISODate()

  const rows = attendance.recent.map((record) => {
    const isToday = record.date === todayISO
    const inProgress = isToday && Boolean(record.clock_in) && !record.clock_out
    return {
      date: formatWATDate(record.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
      clock_in: formatClockTime(record.clock_in),
      clock_out: inProgress ? "In progress" : formatClockTime(record.clock_out),
      total_hours: record.total_hours !== null ? `${record.total_hours.toFixed(2)} hrs` : inProgress ? "Pending" : "-",
      cycle: getCycleLabel(record.date),
      month: formatWATDate(record.date, { month: "long" }),
      status: record.status || "unknown",
      __rawStatus: record.status,
    }
  })

  return (
    <PmsTablePage
      title="PMS Attendance"
      description="Track your daily clock-in records, working hours, and attendance score for the review cycle."
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
      tableTitle="Attendance Log"
      tableDescription={`Attendance entries for ${score.cycle_name || "the selected cycle"}.`}
      rows={rows}
      columns={[
        { key: "date", label: "Date" },
        { key: "clock_in", label: "Clock In" },
        { key: "clock_out", label: "Clock Out" },
        { key: "total_hours", label: "Total Hours" },
        { key: "cycle", label: cycleColumnLabel },
        { key: "status", label: "Status" },
      ]}
      searchPlaceholder="Search attendance records..."
      hideSecondaryFilter
    />
  )
}
