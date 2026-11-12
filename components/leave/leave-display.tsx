import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatLeavePeriod } from "./leave-period"

/** Colour per leave type, so sick, casual and annual leave read apart in a list. The name stays as text. */
function toneFor(name: string) {
  const lower = name.toLowerCase()
  if (lower.includes("sick")) return "border-rose-500/30 bg-rose-500/10 text-rose-600"
  if (lower.includes("casual")) return "border-sky-500/30 bg-sky-500/10 text-sky-600"
  if (lower.includes("annual")) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
  return "border-muted-foreground/30 bg-muted text-muted-foreground"
}

/** A leave type as a coloured badge. Give the name, or the id and the list of types to look it up. */
export function LeaveTypeBadge({
  name,
  id,
  types,
}: {
  name?: string | null
  id?: string
  types?: Map<string, { name: string }>
}) {
  const label = name ?? (id ? types?.get(id)?.name : undefined)
  if (!label) return <span className="text-muted-foreground text-sm">—</span>
  return (
    <Badge variant="outline" className={cn("text-xs font-medium whitespace-nowrap", toneFor(label))}>
      {label}
    </Badge>
  )
}

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
