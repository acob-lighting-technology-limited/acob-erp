import { formatNaira } from "@/lib/requisitions/format"
import { cn } from "@/lib/utils"

interface NairaAmountProps {
  value: number | string | null | undefined
  className?: string
}

/**
 * A naira amount sized to be read at a glance: the whole naira in bold tabular figures, the kobo dimmed so
 * the eye lands on the number that matters. Figures are tabular so amounts line up down a column.
 */
export function NairaAmount({ value, className }: NairaAmountProps) {
  const formatted = formatNaira(value)
  const dot = formatted.lastIndexOf(".")
  const whole = dot === -1 ? formatted : formatted.slice(0, dot)
  const kobo = dot === -1 ? "" : formatted.slice(dot)

  return (
    <span className={cn("text-foreground text-sm font-semibold whitespace-nowrap tabular-nums", className)}>
      {whole}
      {kobo && <span className="text-muted-foreground text-xs font-medium">{kobo}</span>}
    </span>
  )
}
