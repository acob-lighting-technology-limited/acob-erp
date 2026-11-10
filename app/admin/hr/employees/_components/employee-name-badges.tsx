import { Badge } from "@/components/ui/badge"
import { getRoleBadgeColor } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { formatWATDate } from "@/lib/utils/date"
import { ELEVATED_ROLES, getRoleBadgeLabel } from "./employee-helpers"
import type { Employee } from "./employee-types"

/** The small badges beside an employee's name: an elevated role, and an acting delegation. */
export function EmployeeNameBadges({ employee: r }: { employee: Employee }) {
  return (
    <>
      {ELEVATED_ROLES.includes(r.role) && (
        <Badge
          className={cn(
            "shrink-0 px-1.5 py-0 text-xs font-medium whitespace-nowrap shadow-none",
            getRoleBadgeColor(r.role)
          )}
        >
          {getRoleBadgeLabel(r.role)}
        </Badge>
      )}
      {r.delegate_until && (
        <Badge
          variant="outline"
          title={`Acting for a lead until ${formatWATDate(r.delegate_until)}`}
          className="text-info border-info/40 bg-info/10 shrink-0 px-1.5 py-0 text-xs font-medium whitespace-nowrap shadow-none"
        >
          Delegate
        </Badge>
      )}
    </>
  )
}
