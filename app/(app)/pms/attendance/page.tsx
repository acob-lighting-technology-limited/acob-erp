import { redirect } from "next/navigation"
import { PmsTablePage } from "@/app/admin/pms/_components/pms-table-page"
import { computeIndividualPerformanceScore } from "@/lib/performance/scoring"
import { computeAttendanceDay } from "@/lib/hr/attendance-ssot"
import { formatCycleLabel, matchesCadence } from "@/lib/pms/cadence"
import { createClient } from "@/lib/supabase/server"
import { formatWATDate, toLocalISODate } from "@/lib/utils/date"

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

  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  const { data: cycleRows } = await supabase
    .from("review_cycles")
    .select("id, name, start_date, end_date, status, review_type")
    .order("start_date", { ascending: false })

  const cycles = (cycleRows || []).map((c) => ({
    id: c.id,
    name: c.name || "Review Cycle",
    startDate: c.start_date,
    endDate: c.end_date,
    status: c.status || "closed",
    reviewType: c.review_type ?? null,
  }))

  const todayISO = toLocalISODate()

  // Only include quarterly cycles (exclude biannual H1/H2 and annual FY)
  const quarterlyCycles = cycles.filter((c) => matchesCadence("quarterly", c.reviewType, c.name))

  // Filter cycles if a specific quarter cycle was requested in URL
  const targetCycles =
    effectiveCycleId && effectiveCycleId !== "all"
      ? quarterlyCycles.filter((c) => c.id === effectiveCycleId)
      : quarterlyCycles

  // Compute performance score per target cycle in parallel using SSOT scoring
  const cycleScores = await Promise.all(
    targetCycles.map(async (cycle) => {
      const score = await computeIndividualPerformanceScore(supabase, { userId: user.id, cycleId: cycle.id })
      return { cycle, score }
    })
  )

  const rows = cycleScores.map(({ cycle, score }) => {
    const isFuture = cycle.startDate > todayISO
    const att = score.breakdown.attendance
    const records = att.records || []

    let totalWorkHours = 0
    let totalMissedHours = 0

    const formattedRecords = records.map((record) => {
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

      return {
        id: record.id || `rec-${record.date}`,
        date: formatWATDate(record.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
        clock_in: formatClockTime(record.clock_in),
        clock_out: inProgress ? "In progress" : formatClockTime(record.clock_out),
        total_hours: inProgress
          ? "In progress"
          : dayResult.hoursWorked > 0
            ? `${dayResult.hoursWorked.toFixed(1)} hrs`
            : "0.0 hrs",
        status: record.status || dayResult.status || "absent",
        rawStatus: record.status || dayResult.status || "absent",
      }
    })

    const totalDays = isFuture ? 0 : att.total
    const presentCount = isFuture ? 0 : att.present
    const lateCount = isFuture ? 0 : (att.late_days ?? 0)
    const quarterScore =
      isFuture || totalDays === 0 ? null : (att.score ?? Math.round((presentCount / totalDays) * 100))

    return {
      quarter: formatCycleLabel(cycle.name),
      score: formatPercent(quarterScore),
      present_tracked: `${presentCount} / ${totalDays} days`,
      total_work_hours: totalDays > 0 ? `${totalWorkHours.toFixed(1)} hrs` : "-",
      total_miss_hours: totalDays > 0 ? `${totalMissedHours.toFixed(1)} hrs` : "-",
      lateness: `${lateCount} / ${totalDays} days`,
      __presentCount: presentCount,
      __totalDays: totalDays,
      __quarterScore: quarterScore,
      __attendanceRecords: isFuture ? [] : formattedRecords,
    }
  })

  const sumPresent = rows.reduce((sum, r) => sum + r.__presentCount, 0)
  const sumTracked = rows.reduce((sum, r) => sum + r.__totalDays, 0)
  const avgScore = sumTracked > 0 ? Math.round((sumPresent / sumTracked) * 100) : null

  return (
    <PmsTablePage
      title="PMS Attendance"
      description="Track your attendance score and working hours by quarter. Expand any quarter row to inspect the daily clock-in punch logs."
      backHref="/pms"
      backLabel="Back to PMS"
      icon="attendance"
      cycles={cycles}
      summaryCards={[
        { label: "Score", value: formatPercent(avgScore), tooltip: "Attendance Score" },
        { label: "Present Days", value: sumPresent },
        { label: "Tracked Days", value: sumTracked },
      ]}
      tableTitle="Attendance by Quarter"
      tableDescription="Attendance scores by quarter. Expand any quarter to review daily clock-in details."
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
