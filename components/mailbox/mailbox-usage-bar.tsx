"use client"

import { Progress } from "@/components/ui/progress"
import { formatBytes, formatQuota, mailboxLevel, type MailboxLevel } from "@/lib/cpanel/quota"
import { cn } from "@/lib/utils"

const LEVEL_BAR: Record<MailboxLevel, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  alert: "bg-red-500",
}

const LEVEL_TEXT: Record<MailboxLevel, string> = {
  ok: "text-muted-foreground",
  warn: "text-warning",
  alert: "text-danger",
}

/**
 * Mailbox storage as a bar plus "used / quota": green, amber from 80%, red from 90%.
 * `stacked` (default) puts the figures under the bar; `inline` puts them beside it,
 * for a single line such as the profile contact strip.
 */
export function MailboxUsageBar({
  usedBytes,
  quotaBytes,
  usedPercent,
  layout = "stacked",
  className,
}: {
  usedBytes: number
  quotaBytes: number | null
  usedPercent: number | null
  layout?: "stacked" | "inline"
  className?: string
}) {
  const level = mailboxLevel(usedPercent)
  return (
    <div className={cn("min-w-0", layout === "inline" ? "flex items-center gap-2" : "space-y-1", className)}>
      <Progress
        value={usedPercent ?? 0}
        className={cn("h-1.5", layout === "inline" && "w-24 shrink-0")}
        indicatorClassName={LEVEL_BAR[level]}
        aria-label="Mailbox storage used"
      />
      <p className={cn("text-xs whitespace-nowrap tabular-nums", LEVEL_TEXT[level])}>
        {formatBytes(usedBytes)} / {formatQuota(quotaBytes)}
        {usedPercent != null && <span className="ml-1 opacity-80">({Math.round(usedPercent)}%)</span>}
      </p>
    </div>
  )
}
