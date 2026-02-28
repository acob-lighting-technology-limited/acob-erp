"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertTriangle, Loader2, CheckCircle2, List } from "lucide-react"
import { toast } from "sonner"
import type { EmploymentStatus } from "@/types/database"
import { EmployeeStatusBadge } from "./employee-status-badge"
import { createClient } from "@/lib/supabase/client"

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

interface SeparationBlockers {
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
  { value: "separated", label: "Separated", description: "Employee has left the organization" },
  { value: "on_leave", label: "On Leave", description: "Employee is on extended leave" },
]

const separatedReasonOptions = [
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

export function ChangeStatusContent({ employee, onSuccess, onCancel }: ChangeStatusContentProps) {
  const [status, setStatus] = useState<EmploymentStatus>(employee.employment_status)
  const [reasonCode, setReasonCode] = useState("")
  const [suspensionEndDate, setSuspensionEndDate] = useState("")
  const [separationDate, setSeparationDate] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [blockers, setBlockers] = useState<SeparationBlockers | null>(null)
  const [isFetchingCounts, setIsFetchingCounts] = useState(false)
  const [leaveTypeOptions, setLeaveTypeOptions] = useState<LeaveTypeOption[]>([])
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState("")
  const [isLoadingLeaveTypes, setIsLoadingLeaveTypes] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setStatus(employee.employment_status)
    setReasonCode("")
    setSuspensionEndDate("")
    setSeparationDate("")
    setSelectedLeaveTypeId("")
  }, [employee.id, employee.employment_status])

  useEffect(() => {
    if (employee.id) {
      const fetchCounts = async () => {
        setIsFetchingCounts(true)
        try {
          const response = await fetch(`/api/v1/hr/employees/${employee.id}/status`, { method: "GET" })
          if (!response.ok) throw new Error("Failed to load offboarding blockers")
          const result = await response.json()
          setBlockers(result.blockers || null)
        } catch (error) {
          console.error("Error fetching offboarding counts:", error)
        } finally {
          setIsFetchingCounts(false)
        }
      }
      fetchCounts()
    }
  }, [employee.id])

  useEffect(() => {
    const fetchLeaveTypes = async () => {
      if (status !== "on_leave") return
      setIsLoadingLeaveTypes(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("leave_types")
          .select("id, name")
          .eq("is_active", true)
          .order("name")
        if (error) throw error
        setLeaveTypeOptions((data || []) as LeaveTypeOption[])
      } catch (error) {
        console.error("Error fetching leave types:", error)
        toast.error("Failed to load leave options")
      } finally {
        setIsLoadingLeaveTypes(false)
      }
    }

    fetchLeaveTypes()
  }, [status])

  const handleSubmit = async () => {
    if (status === "suspended" && !reasonCode) {
      toast.error("Please select a suspension reason")
      return
    }

    if (status === "on_leave" && !selectedLeaveTypeId) {
      toast.error("Please select a leave type")
      return
    }

    if (status === "separated" && !reasonCode) {
      toast.error("Please select a separation reason")
      return
    }

    if (status === "separated" && !separationDate) {
      toast.error("Please provide a separation date")
      return
    }

    if (status === "separated" && blockers && blockers.total > 0) {
      toast.error("Cannot separate employee with active assignments. Reassign all blockers first.")
      return
    }

    const selectedLeaveType = leaveTypeOptions.find((opt) => opt.id === selectedLeaveTypeId)
    const selectedReasonLabel =
      status === "separated"
        ? separatedReasonOptions.find((opt) => opt.value === reasonCode)?.label
        : status === "suspended"
          ? suspensionReasonOptions.find((opt) => opt.value === reasonCode)?.label
          : status === "on_leave"
            ? selectedLeaveType?.name
            : undefined

    setIsLoading(true)
    try {
      const response = await fetch(`/api/v1/hr/employees/${employee.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          reason_code: reasonCode || undefined,
          reason_label: selectedReasonLabel || undefined,
          leave_type_id: status === "on_leave" ? selectedLeaveTypeId : undefined,
          leave_type_name: status === "on_leave" ? selectedLeaveType?.name : undefined,
          suspension_end_date: status === "suspended" ? suspensionEndDate || null : undefined,
          separation_date: status === "separated" ? separationDate : undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        if (response.status === 409 && error?.blockers) {
          setBlockers(error.blockers)
        }
        throw new Error(error.error || "Failed to update status")
      }

      const result = await response.json()
      toast.success(result.message || "Status updated successfully")

      router.refresh()
      onSuccess?.()
    } catch (error) {
      console.error("Error updating status:", error)
      toast.error(error instanceof Error ? error.message : "Failed to update status")
    } finally {
      setIsLoading(false)
    }
  }

  const isStatusChanged = status !== employee.employment_status
  const isSuspending = status === "suspended"
  const isSeparating = status === "separated"
  const isOnLeave = status === "on_leave"
  const hasSeparationBlockers = isSeparating && (blockers?.total || 0) > 0

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

      {isSeparating && (
        <div className="space-y-2">
          <Label htmlFor="separation-reason">
            Separation Reason <span className="text-destructive">*</span>
          </Label>
          <Select value={reasonCode} onValueChange={setReasonCode}>
            <SelectTrigger id="separation-reason">
              <SelectValue placeholder="Select separation reason" />
            </SelectTrigger>
            <SelectContent>
              {separatedReasonOptions.map((option) => (
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
            min={new Date().toISOString().split("T")[0]}
          />
        </div>
      )}

      {/* Separation Date (only for separated status) */}
      {isSeparating && (
        <div className="space-y-2">
          <Label htmlFor="separation_date">
            Separation Date <span className="text-destructive">*</span>
          </Label>
          <Input
            id="separation_date"
            type="date"
            value={separationDate}
            onChange={(e) => setSeparationDate(e.target.value)}
          />
        </div>
      )}

      {/* Offboarding Checklist (only for separated status) */}
      {isSeparating && (
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
          {!isFetchingCounts && hasSeparationBlockers && (
            <p className="text-xs text-amber-600 italic dark:text-amber-400">
              * Separation is blocked until every active responsibility is unassigned/reassigned.
            </p>
          )}
        </div>
      )}

      {/* Warning for separation */}
      {isSeparating && (
        <div className="bg-destructive/10 border-destructive/20 flex items-start gap-2 rounded-lg border p-3">
          <AlertTriangle className="text-destructive mt-0.5 h-5 w-5 flex-shrink-0" />
          <div className="text-sm">
            <p className="text-destructive font-medium">Warning</p>
            <p className="text-muted-foreground">
              Separating an employee will permanently revoke their access to the system. This action cannot be easily
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
          disabled={isLoading || !isStatusChanged || hasSeparationBlockers}
          variant={isSeparating ? "destructive" : "default"}
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
    </div>
  )
}

export function ChangeStatusDialog({ open, onOpenChange, employee, onSuccess }: ChangeStatusDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Employment Status</DialogTitle>
          <DialogDescription>
            Update the employment status for {employee.first_name} {employee.last_name}
          </DialogDescription>
        </DialogHeader>

        <ChangeStatusContent
          employee={employee}
          onSuccess={() => {
            onOpenChange(false)
            onSuccess?.()
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
