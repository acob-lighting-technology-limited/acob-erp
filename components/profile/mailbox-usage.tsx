"use client"

import { useQuery } from "@tanstack/react-query"
import { HardDrive } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { MailboxUsageBar } from "@/components/mailbox/mailbox-usage-bar"
import { apiFetch } from "@/lib/api-client"
import { MAILBOX_ALERT_PERCENT, formatBytes, formatQuota } from "@/lib/cpanel/quota"

interface MailboxUsage {
  email: string
  usedBytes: number
  quotaBytes: number | null
  usedPercent: number | null
}

async function fetchMailboxUsage(): Promise<MailboxUsage | null> {
  const res = await apiFetch("/api/profile/mailbox", { cache: "no-store" })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error || "Could not read mailbox usage")
  return (json?.data ?? null) as MailboxUsage | null
}

/**
 * The signed-in user's company mailbox storage, for the profile contact strip.
 * Renders nothing when there is no cPanel mailbox to show, or cPanel is down —
 * a storage gauge is never worth an error on someone's profile.
 */
export function MailboxUsage() {
  const { data } = useQuery({
    queryKey: ["profile-mailbox-usage"],
    queryFn: fetchMailboxUsage,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  if (!data) return null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex min-w-0 items-center gap-1.5" tabIndex={0} aria-label="Mailbox storage">
          <HardDrive className="h-3.5 w-3.5 shrink-0" />
          <MailboxUsageBar
            usedBytes={data.usedBytes}
            quotaBytes={data.quotaBytes}
            usedPercent={data.usedPercent}
            className="w-36"
          />
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs space-y-1 text-left">
        <p className="font-medium">Mailbox storage</p>
        <p>
          {data.email} is using {formatBytes(data.usedBytes)} of {formatQuota(data.quotaBytes)}
          {data.usedPercent != null && ` (${Math.round(data.usedPercent)}%)`}.
        </p>
        <p>
          When a mailbox is full, new mail sent to it is rejected. At {MAILBOX_ALERT_PERCENT}% you and ICT are both
          emailed so the quota can be raised.
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
