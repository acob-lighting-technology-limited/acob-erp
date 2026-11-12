import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/** Colour per leave type, so sick, casual and annual leave read apart in a list. The name stays as text. */
function toneFor(name: string) {
  const lower = name.toLowerCase()
  if (lower.includes("sick")) return "border-rose-500/30 bg-rose-500/10 text-rose-600"
  if (lower.includes("casual")) return "border-sky-500/30 bg-sky-500/10 text-sky-600"
  if (lower.includes("annual")) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
  return "border-muted-foreground/30 bg-muted text-muted-foreground"
}

export function LeaveTypeBadge({ name }: { name: string | null | undefined }) {
  if (!name) return <span className="text-muted-foreground text-sm">—</span>
  return (
    <Badge variant="outline" className={cn("text-xs font-medium whitespace-nowrap", toneFor(name))}>
      {name}
    </Badge>
  )
}
