"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ExternalLink, Loader2, Smartphone } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { MailboxUsageBar } from "@/components/mailbox/mailbox-usage-bar"
import { EmailSetupDialog } from "@/components/profile/email-setup-dialog"
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

/** Both pieces read the same cached query, so the mailbox is fetched once. */
function useMailboxUsage() {
  return useQuery({
    queryKey: ["profile-mailbox-usage"],
    queryFn: fetchMailboxUsage,
    staleTime: 5 * 60 * 1000,
    retry: false,
  }).data
}

/**
 * Icon button beside the company email: step-by-step setup of the work mailbox
 * in a phone or computer mail app. Hidden when there is no cPanel mailbox.
 */
export function EmailSetupButton({
  fullName,
  designation,
  phone,
  additionalEmail,
}: {
  fullName: string
  designation: string | null
  phone: string | null
  additionalEmail: string | null
}) {
  const data = useMailboxUsage()
  const [open, setOpen] = useState(false)
  if (!data) return null

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-primary h-6 w-6 shrink-0"
            onClick={() => setOpen(true)}
            aria-label="Set up work email on my phone"
          >
            <Smartphone className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Set up on phone</TooltipContent>
      </Tooltip>
      <EmailSetupDialog
        open={open}
        onOpenChange={setOpen}
        email={data.email}
        fullName={fullName}
        designation={designation}
        phone={phone}
        additionalEmail={additionalEmail}
      />
    </>
  )
}

/**
 * Icon button beside the company email: opens Roundcube already signed in
 * (one-time cPanel session, no password). Hidden when there is no cPanel mailbox.
 */
export function OpenMailboxButton() {
  const data = useMailboxUsage()
  const [opening, setOpening] = useState(false)

  if (!data) return null

  // Open the tab synchronously (inside the click) so popup blockers allow it,
  // then point it at the one-time Roundcube sign-in link once it exists.
  const openWebmail = async () => {
    const tab = window.open("about:blank", "_blank")
    setOpening(true)
    try {
      const res = await apiFetch("/api/profile/mailbox/webmail", { method: "POST" })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.data?.url) throw new Error(json?.error || "Could not open webmail")
      if (tab) {
        tab.opener = null
        tab.location.href = json.data.url as string
      } else {
        window.location.href = json.data.url as string
      }
    } catch (err) {
      tab?.close()
      toast.error(err instanceof Error ? err.message : "Could not open webmail")
    } finally {
      setOpening(false)
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-primary h-6 w-6 shrink-0"
          onClick={() => void openWebmail()}
          disabled={opening}
          aria-label="Open my mailbox in webmail"
        >
          {opening ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">Open mailbox</TooltipContent>
    </Tooltip>
  )
}

/**
 * The signed-in user's company mailbox storage — the line under their company
 * email in the profile contact strip. Renders nothing when there is no cPanel
 * mailbox to show, or cPanel is down: a storage gauge is never worth an error
 * on someone's profile.
 */
export function MailboxUsage() {
  const data = useMailboxUsage()
  if (!data) return null

  return (
    // ml-5 lines the bar up with the email text, past the envelope icon above it.
    <div className="ml-5 min-w-0">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="min-w-0" tabIndex={0} aria-label="Mailbox storage">
            <MailboxUsageBar
              usedBytes={data.usedBytes}
              quotaBytes={data.quotaBytes}
              usedPercent={data.usedPercent}
              layout="inline"
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
    </div>
  )
}
