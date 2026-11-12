import { formatLeavePeriod } from "./leave-period"

/** The period and its length, two short lines: "7 – 7 Oct 2026" then "1 day". */
export function LeavePeriodCell({ start, end, days }: { start: string; end: string; days: number | string }) {
  return (
    <div className="flex flex-col text-xs whitespace-nowrap">
      <span>{formatLeavePeriod(start, end)}</span>
      <span className="text-muted-foreground">
        {days} day{Number(days) === 1 ? "" : "s"}
      </span>
    </div>
  )
}
