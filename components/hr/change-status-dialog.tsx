"use client"

import { useState, useEffect } from "react"
import { logger } from "@/lib/logger"

const log = logger("hr-change-status-dialog")
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertTriangle, Loader2, CheckCircle2, List, Mail, Inbox } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import type { EmployeeMailboxActions, EmployeeMailboxState } from "@/lib/employees/mailbox-state"
import { toast } from "sonner"
import type { EmploymentStatus } from "@/types/database"
import { EmployeeStatusBadge } from "./employee-status-badge"
import { createClient } from "@/lib/supabase/client"
import { toLocalISODate } from "@/lib/utils/date"
import { apiFetch } from "@/lib/api-client"

interface ChangeStatusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: {
    id: string
    first_name: string
    last_name: string
    employment_status: EmploymentStatus
  }
  onSuccess?: () => void
}

interface ChangeStatusContentProps {
  employee: {
    id: string
    first_name: string
    last_name: string
    employment_status: EmploymentStatus
  }
  onSuccess?: () => void
  onCancel?: () => void
}

interface ExitBlockers {
  assets: number
  tasks: number
  task_assignments: number
  managed_projects: number
  project_memberships: number
  lead_roles: number
  total: number
}

interface LeaveTypeOption {
  id: string
  name: string
}

const statusOptions: { value: EmploymentStatus; label: string; description: string }[] = [
  { value: "active", label: "Active", description: "Employee has full access to the system" },
  { value: "suspended", label: "Suspended", description: "Employee is temporarily blocked from accessing the system" },
  { value: "exited", label: "Exited", description: "Employee has exited the organisation" },
  { value: "on_leave", label: "On Leave", description: "Employee is on extended leave" },
]

const exitReasonOptions = [
  { value: "resignation", label: "Resignation" },
  { value: "mutual_separation", label: "Mutual Separation" },
  { value: "contract_completed", label: "Contract Completed" },
  { value: "retirement", label: "Retirement" },
  { value: "workforce_reduction", label: "Workforce Reduction" },
  { value: "disciplinary_dismissal", label: "Disciplinary Dismissal" },
]

const suspensionReasonOptions = [
  { value: "policy_review", label: "Policy Review" },
  { value: "security_investigation", label: "Security Investigation" },
  { value: "administrative_hold", label: "Administrative Hold" },
  { value: "compliance_breach", label: "Compliance Breach" },
  { value: "temporary_access_hold", label: "Temporary Access Hold" },
]

async function fetchEmployeeStatusBlockers(employeeId: string): Promise<ExitBlockers | null> {
  const response = await apiFetch(`/api/v1/hr/employees/${employeeId}/status`, { method: "GET" })
  if (!response.ok) throw new Error("Failed to load offboarding blockers")
  const result = await response.json()
  return result.blockers || null
}

async function fetchEmployeeMailbox(employeeId: string): Promise<EmployeeMailboxState | null> {
  const response = await apiFetch(`/api/admin/hr/employees/${employeeId}/mailbox`, { method: "GET" })
  if (!response.ok) return null
  const result = await response.json().catch(() => null)
  return (result?.data ?? null) as EmployeeMailboxState | null
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function fetchActiveLeaveTypes(): Promise<LeaveTypeOption[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("leave_types").select("id, name").eq("is_active", true).order("name")
  if (error) throw new Error(error.message)
  return (data || []) as LeaveTypeOption[]
}

export function ChangeStatusContent({ employee, onSuccess, onCancel }: ChangeStatusContentProps) {
  const [status, setStatus] = useState<EmploymentStatus>(employee.employment_status)
  const [reasonCode, setReasonCode] = useState("")
  const [suspensionEndDate, setSuspensionEndDate] = useState("")
  const [exitDate, setExitDate] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [exitNotifyOpen, setExitNotifyOpen] = useState(false)
  const [exitedEmployeeId, setExitedEmployeeId] = useState<string | null>(null)
  const [isSendingNotification, setIsSendingNotification] = useState(false)
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState("")
  const [localBlockersOverride, setLocalBlockersOverride] = useState<ExitBlockers | null>(null)
  // Company mailbox steps, confirmed alongside the status change.
  const [suspendMailboxLogin, setSuspendMailboxLogin] = useState(true)
  const [forwardMail, setForwardMail] = useState(true)
  const [forwardTo, setForwardTo] = useState("")
  const [restoreMailboxLogin, setRestoreMailboxLogin] = useState(true)
  const [removeForwards, setRemoveForwards] = useState(true)
  const router = useRouter()

  useEffect(() => {
    setStatus(employee.employment_status)
    setReasonCode("")
    setSuspensionEndDate("")
    setExitDate("")
    setSelectedLeaveTypeId("")
    setLocalBlockersOverride(null)
  }, [employee.id, employee.employment_status])

  const { data: queryBlockers, isFetching: isFetchingCounts } = useQuery({
    queryKey: QUERY_KEYS.hrEmployeeStatusBlockers(employee.id),
    queryFn: () => fetchEmployeeStatusBlockers(employee.id),
    enabled: Boolean(employee.id),
  })

  const blockers = localBlockersOverride ?? queryBlockers ?? null

  const { data: mailboxState, isFetching: isFetchingMailbox } = useQuery({
    queryKey: ["hr-employee-mailbox", employee.id],
    queryFn: () => fetchEmployeeMailbox(employee.id),
    enabled: Boolean(employee.id),
    staleTime: 60 * 1000,
  })
  const mailboxManaged = Boolean(mailboxState?.managed && mailboxState.exists)

  useEffect(() => {
    setSuspendMailboxLogin(true)
    setForwardMail(true)
    setForwardTo(mailboxState?.suggestedForward ?? "")
    setRestoreMailboxLogin(true)
    setRemoveForwards(true)
  }, [status, mailboxState])

  /** The mailbox steps for the chosen status, or undefined when there are none. */
  const buildMailboxActions = (): EmployeeMailboxActions | undefined => {
    if (!mailboxManaged || !mailboxState) return undefined
    if (status === "suspended") return suspendMailboxLogin ? { suspendLogin: true } : undefined
    if (status === "exited") {
      const target = forwardMail ? forwardTo.trim().toLowerCase() : ""
      if (!suspendMailboxLogin && !target) return undefined
      return { suspendLogin: suspendMailboxLogin, forwardTo: target || null }
    }
    if (status === "active") {
      const actions: EmployeeMailboxActions = {
        restoreLogin: mailboxState.suspendedLogin && restoreMailboxLogin,
        removeForwards: removeForwards ? mailboxState.forwards : [],
      }
      return actions.restoreLogin || (actions.removeForwards?.length ?? 0) > 0 ? actions : undefined
    }
    return undefined
  }

  const { data: leaveTypeOptions = [], isFetching: isLoadingLeaveTypes } = useQuery({
    queryKey: QUERY_KEYS.hrLeaveTypesActive(),
    queryFn: fetchActiveLeaveTypes,
    enabled: status === "on_leave",
  })

  const handleSubmit = async () => {
    if (status === "suspended" && !reasonCode) {
      toast.error("Please select a suspension reason")
      return
    }

    if (status === "on_leave" && !selectedLeaveTypeId) {
      toast.error("Please select a leave type")
      return
    }

    if (status === "exited" && !reasonCode) {
      toast.error("Please select an exit reason")
      return
    }

    if (status === "exited" && !exitDate) {
      toast.error("Please provide an exit date")
      return
    }

    if (status === "exited" && mailboxManaged && forwardMail && !EMAIL_PATTERN.test(forwardTo.trim())) {
      toast.error("Enter a valid address to forward mail to, or untick forwarding")
      return
    }

    if (status === "exited" && blockers && blockers.total > 0) {
      toast.error("Cannot exit employee with active assignments. Reassign all blockers first.")
      return
    }

    if (status === "suspended" || status === "exited") {
      setConfirmOpen(true)
      return
    }

    await submitStatusChange()
  }

  const submitStatusChange = async () => {
    const selectedLeaveType = leaveTypeOptions.find((opt) => opt.id === selectedLeaveTypeId)
    const selectedReasonLabel =
      status === "exited"
        ? exitReasonOptions.find((opt) => opt.value === reasonCode)?.label
        : status === "suspended"
          ? suspensionReasonOptions.find((opt) => opt.value === reasonCode)?.label
          : status === "on_leave"
            ? selectedLeaveType?.name
            : undefined

    setConfirmOpen(false)
    setIsLoading(true)
    try {
      const response = await apiFetch(`/api/v1/hr/employees/${employee.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          reason_code: reasonCode || undefined,
          reason_label: selectedReasonLabel || undefined,
          leave_type_id: status === "on_leave" ? selectedLeaveTypeId : undefined,
          leave_type_name: status === "on_leave" ? selectedLeaveType?.name : undefined,
          suspension_end_date: status === "suspended" ? suspensionEndDate || null : undefined,
          separation_date: status === "exited" ? exitDate : undefined,
          mailbox: buildMailboxActions(),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        if (response.status === 409 && error?.blockers) {
          setLocalBlockersOverride(error.blockers as ExitBlockers)
        }
        throw new Error(error.error || "Failed to update status")
      }

      const result = (await response.json()) as {
        message?: string
        mailbox?: { done: string[]; errors: string[] } | null
      }
      toast.success(result.message || "Status updated successfully")
      if (result.mailbox?.done.length) toast.success(result.mailbox.done.join(" · "))
      for (const error of result.mailbox?.errors ?? []) toast.warning(`Mailbox: ${error}`, { duration: 12000 })

      router.refresh()

      if (status === "exited") {
        setExitedEmployeeId(employee.id)
        setExitNotifyOpen(true)
      } else {
        onSuccess?.()
      }
    } catch (error) {
      log.error("Error updating status:", error)
      toast.error(error instanceof Error ? error.message : "Failed to update status")
    } finally {
      setIsLoading(false)
    }
  }

  const isStatusChanged = status !== employee.employment_status
  const isSuspending = status === "suspended"
  const isExiting = status === "exited"
  const isOnLeave = status === "on_leave"
  const hasExitBlockers = isExiting && (blockers?.total || 0) > 0

  return (
    <div className="space-y-4 py-4">
      {/* Current Status */}
      <div className="bg-muted/50 flex items-center justify-between rounded-lg p-3">
        <span className="text-muted-foreground text-sm">Current Status:</span>
        <EmployeeStatusBadge status={employee.employment_status} />
      </div>

      {/* New Status Select */}
      <div className="space-y-2">
        <Label>New Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as EmploymentStatus)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  <EmployeeStatusBadge status={option.value} showIcon={false} size="sm" />
                  <span className="text-muted-foreground ml-2 text-xs">{option.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status-specific selection */}
      {isSuspending && (
        <div className="space-y-2">
          <Label htmlFor="suspension-reason">
            Suspension Reason <span className="text-destructive">*</span>
          </Label>
          <Select value={reasonCode} onValueChange={setReasonCode}>
            <SelectTrigger id="suspension-reason">
              <SelectValue placeholder="Select suspension reason" />
            </SelectTrigger>
            <SelectContent>
              {suspensionReasonOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isOnLeave && (
        <div className="space-y-2">
          <Label htmlFor="leave-type">
            Leave Type <span className="text-destructive">*</span>
          </Label>
          <Select value={selectedLeaveTypeId} onValueChange={setSelectedLeaveTypeId}>
            <SelectTrigger id="leave-type">
              <SelectValue placeholder={isLoadingLeaveTypes ? "Loading leave types..." : "Select leave type"} />
            </SelectTrigger>
            <SelectContent>
              {leaveTypeOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isExiting && (
        <div className="space-y-2">
          <Label htmlFor="exit-reason">
            Exit Reason <span className="text-destructive">*</span>
          </Label>
          <Select value={reasonCode} onValueChange={setReasonCode}>
            <SelectTrigger id="exit-reason">
              <SelectValue placeholder="Select exit reason" />
            </SelectTrigger>
            <SelectContent>
              {exitReasonOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Suspension End Date (only for suspended status) */}
      {isSuspending && (
        <div className="space-y-2">
          <Label htmlFor="suspension_end_date">
            Suspension End Date
            <span className="text-muted-foreground ml-2 text-xs">(optional - leave empty for indefinite)</span>
          </Label>
          <Input
            id="suspension_end_date"
            type="date"
            value={suspensionEndDate}
            onChange={(e) => setSuspensionEndDate(e.target.value)}
            min={toLocalISODate()}
          />
        </div>
      )}

      {/* Exit Date (only for exited status) */}
      {isExiting && (
        <div className="space-y-2">
          <Label htmlFor="exit_date">
            Exit Date <span className="text-destructive">*</span>
          </Label>
          <Input id="exit_date" type="date" value={exitDate} onChange={(e) => setExitDate(e.target.value)} />
        </div>
      )}

      {/* Offboarding Checklist (only for exited status) */}
      {isExiting && (
        <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/30 dark:bg-blue-900/10">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <List className="h-4 w-4" /> Offboarding Checklist
          </h4>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div className="flex flex-col">
              <span className="text-2xl font-bold">{isFetchingCounts ? "..." : blockers?.assets || 0}</span>
              <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                Assigned Assets
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold">{isFetchingCounts ? "..." : blockers?.tasks || 0}</span>
              <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                Individual Tasks
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold">{isFetchingCounts ? "..." : blockers?.task_assignments || 0}</span>
              <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                Multi-Task Assignments
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold">{isFetchingCounts ? "..." : blockers?.managed_projects || 0}</span>
              <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                Managed Projects
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold">
                {isFetchingCounts ? "..." : blockers?.project_memberships || 0}
              </span>
              <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                Project Memberships
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold">{isFetchingCounts ? "..." : blockers?.lead_roles || 0}</span>
              <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                Lead Responsibilities
              </span>
            </div>
          </div>
          {!isFetchingCounts && hasExitBlockers && (
            <p className="text-xs text-amber-600 italic dark:text-amber-400">
              * Exit is blocked until every active responsibility is unassigned/reassigned.
            </p>
          )}
        </div>
      )}

      {/* Company mailbox (cPanel) */}
      {isStatusChanged && (isSuspending || isExiting || status === "active") && mailboxState?.email && (
        <div className="space-y-3 rounded-lg border p-4">
          <h4 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <Inbox className="h-4 w-4" /> Company mailbox
            <span className="text-muted-foreground font-mono text-xs font-normal">{mailboxState.email}</span>
          </h4>
          {isFetchingMailbox && !mailboxState ? (
            <p className="text-muted-foreground text-xs">Checking the mailbox...</p>
          ) : mailboxState.error ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Could not reach cPanel ({mailboxState.error}). The status will still change; update the mailbox in cPanel.
            </p>
          ) : !mailboxState.managed ? (
            <p className="text-muted-foreground text-xs">Not a cPanel mailbox, so Matrix cannot change it.</p>
          ) : !mailboxState.exists ? (
            <p className="text-muted-foreground text-xs">No mailbox exists on cPanel for this address.</p>
          ) : status === "active" ? (
            <>
              {mailboxState.suspendedLogin ? (
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={restoreMailboxLogin}
                    onCheckedChange={(v) => setRestoreMailboxLogin(v === true)}
                    className="mt-0.5"
                  />
                  <span>Restore mailbox login</span>
                </label>
              ) : (
                <p className="text-muted-foreground text-xs">Mailbox login is already active.</p>
              )}
              {mailboxState.forwards.length > 0 && (
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={removeForwards}
                    onCheckedChange={(v) => setRemoveForwards(v === true)}
                    className="mt-0.5"
                  />
                  <span>Stop forwarding to {mailboxState.forwards.join(", ")}</span>
                </label>
              )}
            </>
          ) : (
            <>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={suspendMailboxLogin}
                  onCheckedChange={(v) => setSuspendMailboxLogin(v === true)}
                  className="mt-0.5"
                />
                <span>
                  Suspend mailbox login
                  <span className="text-muted-foreground block text-xs">
                    {mailboxState.suspendedLogin
                      ? "Already suspended."
                      : "They can no longer open the mailbox. Incoming mail still arrives."}
                  </span>
                </span>
              </label>
              {isExiting && (
                <div className="space-y-2">
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={forwardMail}
                      onCheckedChange={(v) => setForwardMail(v === true)}
                      className="mt-0.5"
                    />
                    <span>Forward their incoming mail to</span>
                  </label>
                  {forwardMail && (
                    <Input
                      type="email"
                      value={forwardTo}
                      onChange={(e) => setForwardTo(e.target.value)}
                      placeholder="line.manager@org.acoblighting.com"
                      className="font-mono text-xs"
                    />
                  )}
                  {forwardMail && mailboxState.suggestedForward && (
                    <p className="text-muted-foreground text-xs">Defaults to their department lead.</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Warning for exit */}
      {isExiting && (
        <div className="bg-destructive/10 border-destructive/20 flex items-start gap-2 rounded-lg border p-3">
          <AlertTriangle className="text-destructive mt-0.5 h-5 w-5 flex-shrink-0" />
          <div className="text-sm">
            <p className="text-destructive font-medium">Warning</p>
            <p className="text-muted-foreground">
              Exiting an employee will permanently revoke their access to the system. This action cannot be easily
              undone.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={isLoading || !isStatusChanged || hasExitBlockers}
          variant={isExiting ? "destructive" : "default"}
          className="min-w-[140px]"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Updating...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Update Status
            </>
          )}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isExiting ? "Confirm exit" : "Confirm suspension"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isExiting
                ? "This will remove the employee's access immediately. Are you sure?"
                : "This will suspend the employee's access immediately. Are you sure?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              loading={isLoading}
              onClick={async () => {
                await submitStatusChange()
              }}
            >
              Confirm
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={exitNotifyOpen}
        onOpenChange={(open) => {
          if (!open && !isSendingNotification) {
            setExitNotifyOpen(false)
            onSuccess?.()
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Send Exit Notification?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to send an all-staff notification email informing everyone that{" "}
              <strong>
                {employee.first_name} {employee.last_name}
              </strong>{" "}
              has exited the organisation? An in-app notification will also be created for all active staff.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isSendingNotification}
              onClick={() => {
                setExitNotifyOpen(false)
                onSuccess?.()
              }}
            >
              No, skip
            </AlertDialogCancel>
            <Button
              loading={isSendingNotification}
              onClick={async () => {
                if (!exitedEmployeeId) return
                setIsSendingNotification(true)
                try {
                  const res = await apiFetch(`/api/v1/hr/employees/${exitedEmployeeId}/exit-notification`, {
                    method: "POST",
                  })
                  if (res.ok) {
                    toast.success("Exit notification sent to all staff")
                  } else {
                    const err = await res.json()
                    toast.error(err.error || "Failed to send notification")
                  }
                } catch {
                  toast.error("Failed to send notification")
                } finally {
                  setIsSendingNotification(false)
                  setExitNotifyOpen(false)
                  onSuccess?.()
                }
              }}
            >
              Yes, send notification
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function ChangeStatusDialog({ open, onOpenChange, employee, onSuccess }: ChangeStatusDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Employment Status</DialogTitle>
          <DialogDescription>
            Update the employment status for {employee.first_name} {employee.last_name}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1 pr-4">
          <div className="pb-4">
            <ChangeStatusContent
              employee={employee}
              onSuccess={() => {
                onOpenChange(false)
                onSuccess?.()
              }}
              onCancel={() => onOpenChange(false)}
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
