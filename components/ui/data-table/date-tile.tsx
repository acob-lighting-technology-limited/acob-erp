import { cn } from "@/lib/utils"
import { toLocalISODate } from "@/lib/utils/date"

/**
 * Leading slot for a dated record in the mobile list (a workday, a lunch, a
 * payslip): day number over a short month, the way calendar and timesheet
 * apps file entries. Takes a `YYYY-MM-DD` date and reads it as a calendar
 * date, never shifted by the viewer's time zone.
 */
export function DateTile({ date, className }: { date: string; className?: string }) {
  const [year, month, day] = date.slice(0, 10).split("-").map(Number)
  const value = new Date(Date.UTC(year, (month || 1) - 1, day || 1))
  const isToday = date.slice(0, 10) === toLocalISODate()
  return (
    <span
      className={cn(
        "flex h-11 w-11 flex-col items-center justify-center rounded-lg border leading-none",
        isToday ? "border-primary/40 bg-primary/10 text-primary" : "bg-muted/60 text-foreground",
        className
      )}
      aria-hidden
    >
      <span className="text-base font-bold tabular-nums">{day}</span>
      <span className="text-muted-foreground mt-0.5 text-xs font-medium uppercase">
        {value.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}
      </span>
    </span>
  )
}
