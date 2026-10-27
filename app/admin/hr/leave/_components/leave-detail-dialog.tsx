"use client"

import { useState, useCallback } from "react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { StaffAvatar } from "@/components/ui/staff-avatar"
import { useStaffAvatars } from "@/hooks/use-staff-avatars"
import { Copy, Check, X } from "lucide-react"
import { LeaveItem, getStageBadge } from "../view"
import { formatName, cn } from "@/lib/utils"
import {
  LeaveApprovalStages,
  LeaveAttachments,
  LeaveDetailsList,
  LeaveOverlapNotice,
  LeaveStatusStrip,
  safeDateDisplay,
} from "./leave-detail-sections"

interface LeaveDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  leave: LeaveItem | null
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
  showActionButtons?: boolean
}

function getInitials(name?: string | null): string {
  if (!name) return "LR"
  const clean = name.trim()
  const parts = clean.split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase()
  }
  return clean.slice(0, 2).toUpperCase()
}

export function LeaveDetailDialog({
  open,
  onOpenChange,
  leave,
  onApprove,
  onReject,
  showActionButtons = false,
}: LeaveDetailDialogProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const staffAvatars = useStaffAvatars()

  const handleCopy = useCallback((text: string, fieldName: string) => {
    if (!text) return
    void navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    setTimeout(() => setCopiedField(null), 2000)
  }, [])

  if (!leave) return null

  const statusLower = String(leave.status || "").toLowerCase()
  const isApproved = statusLower === "approved" || statusLower === "completed"
  const isRejected = statusLower === "rejected"
  const isCancelled = statusLower === "cancelled"

  const employeeName = leave.user?.full_name || "Employee"
  const employeeDept = leave.user?.department || "Unassigned"
  const leaveTypeName = leave.leave_type?.name || "—"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-xl">
        {/* Sheet Header — right padding keeps the badges clear of the close button */}
        <SheetHeader className="bg-muted/20 space-y-0 border-b py-3.5 pr-12 pl-4 sm:pl-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <StaffAvatar
                name={employeeName}
                src={staffAvatars[leave.user_id]}
                profileId={leave.user_id}
                initials={getInitials(employeeName)}
                className="h-10 w-10 border text-xs shadow-xs"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle className="truncate text-base font-semibold">{formatName(employeeName)}</SheetTitle>
                  <Badge
                    variant="outline"
                    className="border-blue-200 bg-blue-50/50 text-xs font-medium text-blue-600 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400"
                  >
                    {leaveTypeName}
                  </Badge>
                </div>
                <SheetDescription className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
                  <span>{employeeDept}</span>
                  <span>•</span>
                  <span>
                    {safeDateDisplay(leave.start_date)} – {safeDateDisplay(leave.end_date)} ({leave.days_count}{" "}
                    {leave.days_count === 1 ? "day" : "days"})
                  </span>
                </SheetDescription>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {getStageBadge(leave)}
              <Badge
                className={cn(
                  "px-2 py-0.5 text-xs font-medium capitalize",
                  isApproved
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                    : isRejected || isCancelled
                      ? "border-red-500/20 bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400"
                      : "border-amber-500/20 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
                )}
                variant="outline"
              >
                {leave.status}
              </Badge>
            </div>
          </div>
        </SheetHeader>

        {/* Scrollable body — flat sections divided by rules, no nested cards */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="divide-y px-4 sm:px-5">
            <div className="space-y-2.5 py-4">
              <LeaveStatusStrip leave={leave} />
              <LeaveOverlapNotice leave={leave} />
              {/* Dates and duration already live in the header */}
              <div className="pt-1">
                <LeaveDetailsList leave={leave} />
              </div>
            </div>
            <div className="py-4">
              <LeaveApprovalStages leave={leave} />
            </div>
            <div className="py-4">
              <LeaveAttachments leave={leave} />
            </div>
          </div>
        </div>

        {/* Sheet Footer */}
        <SheetFooter className="bg-muted/20 flex flex-row items-center justify-between gap-2 border-t px-5 py-3 sm:px-6">
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <span className="hidden sm:inline">Request ID:</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => handleCopy(leave.id, "ID")}
                  className="hover:text-foreground inline-flex items-center gap-1 font-mono transition-colors"
                  aria-label="Copy request ID"
                >
                  <span>{leave.id.slice(0, 8)}...</span>
                  {copiedField === "ID" ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3 opacity-60" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Click to copy request ID</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
              Close
            </Button>

            {showActionButtons && (onApprove || onReject) && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onReject?.(leave.id)}
                  className="h-8 gap-1.5 border-red-200 text-xs text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:border-red-900"
                >
                  <X className="h-3.5 w-3.5" /> Reject
                </Button>
                <Button
                  size="sm"
                  onClick={() => onApprove?.(leave.id)}
                  className="h-8 gap-1.5 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                >
                  <Check className="h-3.5 w-3.5" /> Endorse
                </Button>
              </>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
