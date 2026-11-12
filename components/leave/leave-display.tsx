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

interface LeaveTypeRow {
  leave_type_id: string
  user?: { full_name?: string | null; department?: string | null } | null
}

/** The staff leave list's Employee / Leave Type cell: a name, with the type as a badge on other tabs. */
export function LeaveTypeCell({
  row,
  showsEmployee,
  types,
}: {
  row: LeaveTypeRow
  showsEmployee: boolean
  types: Map<string, { name: string }>
}) {
  return (
    <div className="space-y-0.5">
      <span className="block font-medium">
        {showsEmployee ? row.user?.full_name || "Employee" : <LeaveTypeBadge id={row.leave_type_id} types={types} />}
      </span>
      {showsEmployee && (
        <span className="text-muted-foreground block text-xs">
          {row.user?.department || types.get(row.leave_type_id)?.name || "Leave"}
        </span>
      )}
    </div>
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
