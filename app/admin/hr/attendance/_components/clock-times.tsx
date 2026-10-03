import { Clock } from "lucide-react"
import { formatTime } from "./status-badge"

/**
 * Clock-in / clock-out pair for a mobile attendance row — the same green and
 * red clock icons the table columns use, instead of "In:" / "Out:" labels.
 */
export function ClockTimes({ clockIn, clockOut }: { clockIn: string | null; clockOut: string | null }) {
  return (
    <span className="inline-flex items-center gap-3 tabular-nums">
      <span className="inline-flex items-center gap-1">
        <Clock className="h-3 w-3 shrink-0 text-green-600" aria-label="Clock in" />
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
