"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertTriangle, Loader2, CheckCircle2, List } from "lucide-react"
import { toast } from "sonner"
import type { EmploymentStatus } from "@/types/database"
import { EmployeeStatusBadge } from "./employee-status-badge"

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

const statusOptions: { value: EmploymentStatus; label: string; description: string }[] = [
  { value: "active", label: "Active", description: "Employee has full access to the system" },
  { value: "suspended", label: "Suspended", description: "Employee is temporarily blocked from accessing the system" },
  { value: "terminated", label: "Terminated", description: "Employee's account is permanently deactivated" },
  { value: "on_leave", label: "On Leave", description: "Employee is on extended leave" },
]

export function ChangeStatusContent({ employee, onSuccess, onCancel }: ChangeStatusContentProps) {
  const [status, setStatus] = useState<EmploymentStatus>(employee.employment_status)
  const [reason, setReason] = useState("")
  const [suspensionEndDate, setSuspensionEndDate] = useState("")
  const [terminationDate, setTerminationDate] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [counts, setCounts] = useState<{ assets: number; tasks: number } | null>(null)
  const [isFetchingCounts, setIsFetchingCounts] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (employee.id) {
      const fetchCounts = async () => {
        setIsFetchingCounts(true)
        try {
          const supabase = createClient()
          const [assetsRes, tasksRes] = await Promise.all([
            supabase
              .from("asset_assignments")
              .select("id", { count: "exact", head: true })
              .eq("assigned_to", employee.id)
              .eq("is_current", true),
            supabase
              .from("tasks")
              .select("id", { count: "exact", head: true })
              .eq("assigned_to", employee.id)
              .neq("status", "completed"),
          ])
          setCounts({
            assets: assetsRes.count || 0,
            tasks: tasksRes.count || 0,
          })
        } catch (error) {
          console.error("Error fetching offboarding counts:", error)
        } finally {
          setIsFetchingCounts(false)
        }
      }
      fetchCounts()
    }
  }, [employee.id])

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for the status change")
      return
    }

    if (status === "terminated" && !terminationDate) {
      toast.error("Please provide a termination date")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/v1/hr/employees/${employee.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          reason,
          suspension_end_date: status === "suspended" ? suspensionEndDate || null : undefined,
          termination_date: status === "terminated" ? terminationDate : undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
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
  const isTerminating = status === "terminated"

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

      {/* Reason */}
      <div className="space-y-2">
        <Label htmlFor="reason">
          Reason <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="reason"
          placeholder={
            isSuspending
              ? "e.g., Pending investigation..."
              : isTerminating
                ? "e.g., Resignation, Contract ended..."
                : "Reason for status change..."
          }
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
      </div>

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

      {/* Termination Date (only for terminated status) */}
      {isTerminating && (
        <div className="space-y-2">
          <Label htmlFor="termination_date">
            Termination Date <span className="text-destructive">*</span>
          </Label>
          <Input
            id="termination_date"
            type="date"
            value={terminationDate}
            onChange={(e) => setTerminationDate(e.target.value)}
          />
        </div>
      )}

      {/* Offboarding Checklist (only for terminated status) */}
      {isTerminating && (
        <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/30 dark:bg-blue-900/10">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <List className="h-4 w-4" /> Offboarding Checklist
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <span className="text-2xl font-bold">{isFetchingCounts ? "..." : counts?.assets || 0}</span>
              <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                Assigned Assets
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold">{isFetchingCounts ? "..." : counts?.tasks || 0}</span>
              <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                Active Tasks
              </span>
            </div>
          </div>
          {counts && (counts.assets > 0 || counts.tasks > 0) && !isFetchingCounts && (
            <p className="text-xs text-amber-600 italic dark:text-amber-400">
              * Recommendation: Reassign these items before completing termination.
            </p>
          )}
        </div>
      )}

      {/* Warning for termination */}
      {isTerminating && (
        <div className="bg-destructive/10 border-destructive/20 flex items-start gap-2 rounded-lg border p-3">
          <AlertTriangle className="text-destructive mt-0.5 h-5 w-5 flex-shrink-0" />
          <div className="text-sm">
            <p className="text-destructive font-medium">Warning</p>
            <p className="text-muted-foreground">
              Terminating an employee will permanently revoke their access to the system. This action cannot be easily
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
          disabled={isLoading || !isStatusChanged}
          variant={isTerminating ? "destructive" : "default"}
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
