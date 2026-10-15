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
  warn: "text-amber-600 dark:text-amber-400",
  alert: "text-red-600 dark:text-red-400",
}

/** Mailbox storage as a bar plus "used / quota": green, amber from 80%, red from 90%. */
export function MailboxUsageBar({
  usedBytes,
  quotaBytes,
  usedPercent,
  className,
}: {
  usedBytes: number
  quotaBytes: number | null
  usedPercent: number | null
  className?: string
}) {
  const level = mailboxLevel(usedPercent)
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <Progress
        value={usedPercent ?? 0}
        className="h-1.5"
        indicatorClassName={LEVEL_BAR[level]}
        aria-label="Mailbox storage used"
      />
      <p className={cn("text-xs tabular-nums", LEVEL_TEXT[level])}>
        {formatBytes(usedBytes)} / {formatQuota(quotaBytes)}
        {usedPercent != null && <span className="ml-1 opacity-80">({Math.round(usedPercent)}%)</span>}
      </p>
    </div>
  )
}
