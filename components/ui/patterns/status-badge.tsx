import type { LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { statusLabel, statusTone, type StatusTone } from "@/lib/status-tones"

interface StatusBadgeProps {
  status: string | null | undefined
  /** Override the label (defaults to the humanised status). */
  label?: string
  /** Force a tone instead of looking the status up. */
  tone?: StatusTone
  /** Domain-specific tone refinements, e.g. `{ returned: "danger" }`. */
  tones?: Record<string, StatusTone>
  icon?: LucideIcon
  className?: string
}

/**
 * The single way to render a status. Colour comes from the status's *meaning*
 * (lib/status-tones.ts) and theme tokens — never a hand-picked bg-green-100.
 */
export function StatusBadge({ status, label, tone, tones, icon: Icon, className }: StatusBadgeProps) {
  return (
    <Badge variant={tone ?? statusTone(status, tones)} className={className}>
      {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
      {label ?? statusLabel(status)}
    </Badge>
  )
}
