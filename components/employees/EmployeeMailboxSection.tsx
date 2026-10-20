"use client"

import { useEffect, useState } from "react"
import { depsChanged } from "@/lib/utils/deps-changed"
import { useQuery } from "@tanstack/react-query"
import { Inbox } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { apiFetch } from "@/lib/api-client"
import type { EmployeeMailboxActions, EmployeeMailboxState } from "@/lib/employees/mailbox-state"

async function fetchEmployeeMailbox(employeeId: string): Promise<EmployeeMailboxState | null> {
  const response = await apiFetch(`/api/admin/hr/employees/${employeeId}/mailbox`, { method: "GET" })
  if (!response.ok) return null
  const result = await response.json().catch(() => null)
  return (result?.data ?? null) as EmployeeMailboxState | null
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * "Company mailbox" options shown in the Edit Employee form when the status
 * changes. Suspending or exiting someone suspends their mailbox login by
 * default (and on exit forwards their mail to their department lead), so it
 * happens every time unless HR deliberately unticks it — e.g. for a handover.
 * Reactivating offers to restore login and stop forwarding.
 *
 * Reports the chosen steps through `onActionsChange` (undefined = none); the
 * second argument is true while the forward address is invalid, so the form
 * can refuse to save rather than silently skip the suspension. The status
 * route applies the steps after saving.
 */
export function EmployeeMailboxSection({
  employeeId,
  fromStatus,
  toStatus,
  onActionsChange,
}: {
  employeeId: string
  fromStatus: string
  toStatus: string
  onActionsChange: (actions: EmployeeMailboxActions | undefined, invalid: boolean) => void
}) {
  const [suspendLogin, setSuspendLogin] = useState(true)
  const [forwardMail, setForwardMail] = useState(true)
  const [forwardTo, setForwardTo] = useState("")
  const [restoreLogin, setRestoreLogin] = useState(true)
  const [removeForwards, setRemoveForwards] = useState(true)

  const leaving = toStatus === "suspended" || toStatus === "exited"
  const returning = toStatus === "active" && (fromStatus === "suspended" || fromStatus === "exited")
  const relevant = toStatus !== fromStatus && (leaving || returning)

  const { data: mailbox, isFetching } = useQuery({
    queryKey: ["hr-employee-mailbox", employeeId],
    queryFn: () => fetchEmployeeMailbox(employeeId),
    enabled: Boolean(employeeId) && relevant,
    staleTime: 60 * 1000,
  })
  const manageable = Boolean(mailbox?.managed && mailbox.exists && !mailbox.error)

  // Defaults reset only when the target status or suggested forward changes,
  // never on a background refetch, so HR's choices stick.
  const [seeded, setSeeded] = useState<readonly unknown[] | null>(null)
  const seededForNext = [toStatus, mailbox?.suggestedForward] as const
  if (depsChanged(seeded, seededForNext)) {
    setSeeded(seededForNext)
    setSuspendLogin(true)
    setForwardMail(true)
    setForwardTo(mailbox?.suggestedForward ?? "")
    setRestoreLogin(true)
    setRemoveForwards(true)
  }

  useEffect(() => {
    if (!relevant || !manageable || !mailbox) return onActionsChange(undefined, false)
    if (leaving) {
      // Ticking "forward" is a promise to forward: a blank address blocks the
      // save just like a malformed one, rather than silently forwarding nothing.
      const wantsForward = toStatus === "exited" && forwardMail
      const target = wantsForward ? forwardTo.trim().toLowerCase() : ""
      if (wantsForward && !EMAIL_PATTERN.test(target)) return onActionsChange(undefined, true)
      if (!suspendLogin && !target) return onActionsChange(undefined, false)
      return onActionsChange({ suspendLogin, forwardTo: target || null }, false)
    }
    const actions: EmployeeMailboxActions = {
      restoreLogin: mailbox.suspendedLogin && restoreLogin,
      removeForwards: removeForwards ? mailbox.forwards : [],
    }
    onActionsChange(actions.restoreLogin || (actions.removeForwards?.length ?? 0) > 0 ? actions : undefined, false)
  }, [
    relevant,
    manageable,
    mailbox,
    leaving,
    toStatus,
    suspendLogin,
    forwardMail,
    forwardTo,
    restoreLogin,
    removeForwards,
    onActionsChange,
  ])

  if (!relevant) return null

  const forwardInvalid = toStatus === "exited" && forwardMail && !EMAIL_PATTERN.test(forwardTo.trim())

  return (
    <div className="space-y-2.5 rounded border p-3 text-xs sm:col-span-2">
      <p className="flex flex-wrap items-center gap-1.5 font-semibold">
        <Inbox className="h-3.5 w-3.5" /> Company mailbox
        {mailbox?.email && <span className="text-muted-foreground font-mono font-normal">{mailbox.email}</span>}
      </p>

      {isFetching && !mailbox ? (
        <p className="text-muted-foreground">Checking the mailbox...</p>
      ) : !mailbox?.email ? (
        <p className="text-muted-foreground">No company email on this profile.</p>
      ) : mailbox.error ? (
        <p className="text-amber-600 dark:text-amber-400">
          Could not reach cPanel ({mailbox.error}). The status will still change; update the mailbox in cPanel.
        </p>
      ) : !mailbox.managed ? (
        <p className="text-muted-foreground">Not a cPanel mailbox, so Matrix cannot change it.</p>
      ) : !mailbox.exists ? (
        <p className="text-muted-foreground">No mailbox exists on cPanel for this address.</p>
      ) : returning ? (
        <>
          {mailbox.suspendedLogin ? (
            <label className="flex items-start gap-2">
              <Checkbox checked={restoreLogin} onCheckedChange={(v) => setRestoreLogin(v === true)} />
              <span>Restore mailbox login</span>
            </label>
          ) : (
            <p className="text-muted-foreground">Mailbox login is already active.</p>
          )}
          {mailbox.forwards.length > 0 && (
            <label className="flex items-start gap-2">
              <Checkbox checked={removeForwards} onCheckedChange={(v) => setRemoveForwards(v === true)} />
              <span>Stop forwarding to {mailbox.forwards.join(", ")}</span>
            </label>
          )}
        </>
      ) : (
        <>
          <label className="flex items-start gap-2">
            <Checkbox checked={suspendLogin} onCheckedChange={(v) => setSuspendLogin(v === true)} />
            <span>
              Suspend mailbox login
              <span className="text-muted-foreground block">
                {mailbox.suspendedLogin
                  ? "Already suspended."
                  : "They can no longer open or send from the mailbox. Incoming mail still arrives."}
              </span>
            </span>
          </label>
          {toStatus === "exited" && (
            <div className="space-y-1.5">
              <label className="flex items-start gap-2">
                <Checkbox checked={forwardMail} onCheckedChange={(v) => setForwardMail(v === true)} />
                <span>Forward their incoming mail to</span>
              </label>
              {forwardMail && (
                <>
                  <Input
                    type="email"
                    value={forwardTo}
                    onChange={(e) => setForwardTo(e.target.value)}
                    placeholder="line.manager@org.acoblighting.com"
                    className="h-8 font-mono text-xs"
                    aria-invalid={forwardInvalid}
                  />
                  <p className={forwardInvalid ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}>
                    {!forwardInvalid
                      ? "Defaults to their department lead."
                      : forwardTo.trim() === "" && !mailbox.suggestedForward
                        ? "No department lead found. Enter an address, or untick forwarding."
                        : "Enter a valid email address, or untick forwarding."}
                  </p>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
