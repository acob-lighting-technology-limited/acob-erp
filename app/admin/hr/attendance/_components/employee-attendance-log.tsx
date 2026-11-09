import { AlertCircle, CalendarDays, Clock, Info, Pencil, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/ui/stat-card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { AttendanceReport, CalendarDay, DayRecord } from "../view"
import { StatusBadge } from "./status-badge"

interface HourBreakdown {
  total: number | null
  work: number | null
  overtime: number | null
  missed: number | null
}

interface EmployeeAttendanceLogProps {
  days: CalendarDay[]
  report: AttendanceReport
  periodLabel: string
  getHours: (day: CalendarDay) => HourBreakdown
  getSourceLabel: (day: CalendarDay) => string
  onEdit: (date: string, record: DayRecord | null) => void
  onOpenHistory: (day: CalendarDay) => void
}

function formatTime(time: string | null) {
  return time ? time.substring(0, 5) : "—"
}

function formatHours(hours: number | null) {
  return hours === null ? "—" : `${hours.toFixed(1)}h`
}

export function EmployeeAttendanceLog({
  days,
  report,
  periodLabel,
  getHours,
  getSourceLabel,
  onEdit,
  onOpenHistory,
}: EmployeeAttendanceLogProps) {
  return (
    <section aria-label={`Attendance for ${report.user_name}`} className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-muted-foreground text-xs font-medium">Attendance record</p>
          <h3 className="text-foreground text-lg font-semibold tracking-tight">{periodLabel}</h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {days.length} completed day{days.length === 1 ? "" : "s"} in this period
          </p>
        </div>
        <div className="border-border bg-muted/40 flex items-center gap-2 rounded-lg border px-3 py-2">
          <AlertCircle className="text-warning h-4 w-4" aria-hidden="true" />
          <span className="text-muted-foreground text-xs">Missed time</span>
          <span className="text-foreground text-sm font-semibold">{formatHours(report.total_missed_hours ?? 0)}</span>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
        <SummaryGroup
          icon={AlertCircle}
          title="Needs attention"
          iconBgColor="bg-warning/10"
          iconColor="text-warning"
          metrics={[
            { label: "Late", value: report.late_days, valueClassName: "text-warning" },
            { label: "Incomplete", value: report.incomplete_days ?? 0, valueClassName: "text-info" },
            { label: "Absent", value: report.absent_days, valueClassName: "text-danger" },
          ]}
        />
        <SummaryGroup
          icon={ShieldCheck}
          title="Approved exceptions"
          iconBgColor="bg-info/10"
          iconColor="text-info"
          metrics={[
            { label: "LWP", value: report.lateness_with_permission_days ?? 0, valueClassName: "text-warning" },
            { label: "IWP", value: report.incomplete_with_permission_days ?? 0, valueClassName: "text-info" },
            { label: "AWP", value: report.absent_with_permission_days ?? 0, valueClassName: "text-primary" },
            { label: "OOS", value: report.out_of_station_days ?? 0, valueClassName: "text-info" },
            { label: "Waiver", value: report.waived_days, valueClassName: "text-primary" },
          ]}
        />
        <SummaryGroup
          icon={CalendarDays}
          title="Covered days"
          iconBgColor="bg-success/10"
          iconColor="text-success"
          metrics={[
            { label: "Leave", value: report.leave_days ?? 0, valueClassName: "text-success" },
            { label: "Holiday", value: report.holiday_days ?? 0, valueClassName: "text-info" },
            { label: "Exempted", value: report.exempted_days ?? 0, valueClassName: "text-purple" },
          ]}
        />
      </div>

      <div className="border-border bg-card overflow-hidden rounded-xl border">
        <div className="border-border bg-muted/40 text-muted-foreground hidden grid-cols-10 gap-3 border-b px-4 py-3 text-xs font-semibold tracking-wide uppercase lg:grid">
          <span>Day</span>
          <span>Status</span>
          <span>In</span>
          <span>Out</span>
          <span>Work</span>
          <span>Missed</span>
          <span>Total</span>
          <span>Overtime</span>
          <span>Source</span>
          <span className="text-right">Actions</span>
        </div>

        <div className="divide-border divide-y">
          {days.map((day) => {
            const hours = getHours(day)
            const sourceLabel = getSourceLabel(day)

            return (
              <div key={day.date}>
                <div className="hover:bg-muted/30 hidden grid-cols-10 items-center gap-3 px-4 py-3 transition-colors lg:grid">
                  <span className="text-foreground truncate text-xs font-semibold">{day.dayName}</span>
                  <div className="min-w-0">
                    <StatusBadge
                      status={day.status}
                      waived={day.record?.waived}
                      record={day.record}
                      earlyClosure={day.earlyClosureTime ? { closeTime: day.earlyClosureTime } : null}
                      recordDate={day.date}
                    />
                  </div>
                  <TimeValue time={day.record?.clock_in ?? null} status={day.status} />
                  <TimeValue time={day.record?.clock_out ?? null} />
                  <span className="text-foreground text-xs">{formatHours(hours.work)}</span>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      hours.missed && hours.missed > 0 ? "text-warning" : "text-muted-foreground"
                    )}
                  >
                    {formatHours(hours.missed)}
                  </span>
                  <span className="text-foreground text-xs">
                    {formatHours(hours.total ?? day.record?.total_hours ?? null)}
                  </span>
                  <span className="text-foreground text-xs">
                    {hours.overtime !== null && hours.overtime >= 0.05 ? `+${formatHours(hours.overtime)}` : "—"}
                  </span>
                  <span className="text-muted-foreground truncate text-xs" title={sourceLabel}>
                    {sourceLabel}
                  </span>
                  <RowActions day={day} onEdit={onEdit} onOpenHistory={onOpenHistory} />
                </div>

                <div className="space-y-3 px-4 py-3 lg:hidden">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-foreground text-sm font-semibold">{day.dayName}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">{sourceLabel}</p>
                    </div>
                    <StatusBadge
                      status={day.status}
                      waived={day.record?.waived}
                      record={day.record}
                      earlyClosure={day.earlyClosureTime ? { closeTime: day.earlyClosureTime } : null}
                      recordDate={day.date}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-x-3 gap-y-2 text-xs">
                    <MobileMetric label="In" value={formatTime(day.record?.clock_in ?? null)} />
                    <MobileMetric label="Out" value={formatTime(day.record?.clock_out ?? null)} />
                    <MobileMetric label="Work" value={formatHours(hours.work)} />
                    <MobileMetric
                      label="Missed"
                      value={formatHours(hours.missed)}
                      warning={Boolean(hours.missed && hours.missed > 0)}
                    />
                    <MobileMetric label="Total" value={formatHours(hours.total ?? day.record?.total_hours ?? null)} />
                    <MobileMetric
                      value={
                        hours.overtime !== null && hours.overtime >= 0.05 ? `+${formatHours(hours.overtime)}` : "—"
                      }
                      label="Overtime"
                    />
                  </div>
                  <RowActions day={day} onEdit={onEdit} onOpenHistory={onOpenHistory} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

interface SummaryMetric {
  label: string
  value: number
  valueClassName: string
}

function SummaryGroup({
  icon: Icon,
  title,
  iconBgColor,
  iconColor,
  metrics,
}: {
  icon: typeof AlertCircle
  title: string
  iconBgColor: string
  iconColor: string
  metrics: SummaryMetric[]
}) {
  const total = metrics.reduce((sum, metric) => sum + metric.value, 0)
  const tooltip = metrics.map((metric) => `${metric.label}: ${metric.value}`).join(" · ")

  return (
    <StatCard
      variant="compact"
      title={title}
      value={`${total} days`}
      icon={Icon}
      iconBgColor={iconBgColor}
      iconColor={iconColor}
      tooltip={tooltip}
      detail={metrics.map((metric) => (
        <span key={metric.label} className="whitespace-nowrap">
          {metric.label} <span className={cn("font-semibold", metric.valueClassName)}>{metric.value}</span>
        </span>
      ))}
    />
  )
}

function TimeValue({ time, status }: { time: string | null; status?: string }) {
  if (!time) return <span className="text-muted-foreground text-xs">—</span>
  const isLate = status === "late" || status === "lateness_with_permission"
  return (
    <span className={cn("flex items-center gap-1.5 text-xs", isLate ? "text-warning" : "text-foreground")}>
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      {formatTime(time)}
    </span>
  )
}

function MobileMetric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 font-medium", warning ? "text-warning" : "text-foreground")}>{value}</dd>
    </div>
  )
}

function RowActions({
  day,
  onEdit,
  onOpenHistory,
}: {
  day: CalendarDay
  onEdit: (date: string, record: DayRecord | null) => void
  onOpenHistory: (day: CalendarDay) => void
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onOpenHistory(day)}
            aria-label={`View history for ${day.dayName}`}
          >
            <Info className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">View edit history</TooltipContent>
      </Tooltip>
      {!day.isOnLeave && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onEdit(day.date, day.record)}
              aria-label={`Edit ${day.dayName}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Edit attendance</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
