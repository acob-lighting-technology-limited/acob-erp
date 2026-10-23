import { Clock } from "lucide-react"
import { formatTime } from "./status-badge"
import { isLate } from "@/lib/hr/attendance-utils"
import { cn } from "@/lib/utils"

/**
 * Clock-in / clock-out pair for a mobile attendance row — the same green/late and
 * red clock icons the table columns use, instead of "In:" / "Out:" labels.
 */
export function ClockTimes({
  clockIn,
  clockOut,
  isLate: isLateProp,
}: {
  clockIn: string | null
  clockOut: string | null
  isLate?: boolean
}) {
  const late = isLateProp ?? isLate(clockIn)
  return (
    <span className="inline-flex items-center gap-3 tabular-nums">
      <span className="inline-flex items-center gap-1">
        <Clock
          className={cn("h-3 w-3 shrink-0", late ? "text-yellow-600 dark:text-yellow-500" : "text-green-600")}
          aria-label="Clock in"
        />
        {clockIn ? formatTime(clockIn) : "—"}
      </span>
      <span className="inline-flex items-center gap-1">
        <Clock className="h-3 w-3 shrink-0 text-red-500" aria-label="Clock out" />
        {clockOut ? formatTime(clockOut) : "—"}
      </span>
    </span>
  )
}

/** Name with the department's short code beside it, for a mobile row title. */
export function NameWithDept({ name, code }: { name: string; code: string }) {
  return (
    <>
      {name}
      {code ? <span className="text-muted-foreground ml-1.5 text-xs font-medium">{code}</span> : null}
    </>
  )
}
