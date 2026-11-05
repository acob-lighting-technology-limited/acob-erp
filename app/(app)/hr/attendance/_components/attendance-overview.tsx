import { AlertCircle, CalendarDays, Clock3, UserCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface AttendanceOverviewProps {
  attendedDays: number
  totalWorkdays: number
  totalWorkedHours: number
  totalMissedHours: number
  periodLabel: string
  todayStatusClassName: string
  todayStatusLabel: string
}

function formatHours(hours: number) {
  return `${hours.toFixed(1)}h`
}

export function AttendanceOverview({
  attendedDays,
  totalWorkdays,
  totalWorkedHours,
  totalMissedHours,
  periodLabel,
  todayStatusClassName,
  todayStatusLabel,
}: AttendanceOverviewProps) {
  const attendanceRate = totalWorkdays > 0 ? Math.round((attendedDays / totalWorkdays) * 100) : null

  return (
    <section aria-labelledby="attendance-overview-title" className="grid gap-3 lg:grid-cols-4">
      <Card className="border-primary/25 bg-card overflow-hidden lg:col-span-2">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-medium">Attendance overview</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <h2
                  id="attendance-overview-title"
                  className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl"
                >
                  {attendedDays} of {totalWorkdays} days
                </h2>
                {attendanceRate !== null && (
                  <span className="text-primary text-sm font-semibold">{attendanceRate}% recorded</span>
                )}
              </div>
              <p className="text-muted-foreground mt-1 text-xs">Your recorded workdays in {periodLabel}</p>
            </div>

            <div className="border-border bg-muted/35 flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2">
              <span className="text-muted-foreground text-xs font-medium">Today</span>
              <Badge className={cn("shrink-0", todayStatusClassName)}>{todayStatusLabel}</Badge>
            </div>
          </div>

          <div
            className="bg-muted mt-4 h-1.5 overflow-hidden rounded-full"
            role="meter"
            aria-label="Attendance recorded"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={attendanceRate ?? 0}
          >
            <div
              className="bg-primary h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${attendanceRate ?? 0}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <MetricCard
        icon={UserCheck}
        label="Recorded days"
        value={`${attendedDays} / ${totalWorkdays}`}
        description="Expected workdays"
      />
      <MetricCard
        icon={Clock3}
        label="Credited time"
        value={formatHours(totalWorkedHours)}
        description="Verified work hours"
      />
      <MetricCard
        icon={AlertCircle}
        label="Missed time"
        value={formatHours(totalMissedHours)}
        description="Unworked hours in the period"
        tone={totalMissedHours > 0 ? "warning" : "neutral"}
      />
    </section>
  )
}

interface MetricCardProps {
  icon: typeof CalendarDays
  label: string
  value: string
  description: string
  tone?: "neutral" | "warning"
}

function MetricCard({ icon: Icon, label, value, description, tone = "neutral" }: MetricCardProps) {
  const iconClassName = tone === "warning" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"

  return (
    <Card className="border-border/80 bg-card">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-medium">{label}</p>
            <p className="text-foreground mt-1 text-xl font-semibold tracking-tight">{value}</p>
          </div>
          <div className={cn("rounded-lg p-2", iconClassName)}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>
        <p className="text-muted-foreground mt-3 text-xs">{description}</p>
      </CardContent>
    </Card>
  )
}
