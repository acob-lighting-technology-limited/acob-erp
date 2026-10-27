"use client"

import { useState, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DetailSheet } from "@/components/ui/detail-sheet"
import { StatusBadge } from "@/components/ui/patterns/status-badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { StaffAvatar } from "@/components/ui/staff-avatar"
import { useStaffAvatars } from "@/hooks/use-staff-avatars"
import { Copy, Check, X } from "lucide-react"
import { LeaveItem, getStageBadge } from "../view"
import { formatName } from "@/lib/utils"
import {
  LeaveApprovalStages,
  LeaveAttachments,
  LeaveDetailsList,
  LeaveOverlapNotice,
  LeaveStatusStrip,
  safeDateDisplay,
} from "./leave-detail-sections"

interface LeaveDetailSheetProps {
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

export function LeaveDetailSheet({
  open,
  onOpenChange,
  leave,
  onApprove,
  onReject,
  showActionButtons = false,
}: LeaveDetailSheetProps) {
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
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      leading={
        <StaffAvatar
          name={employeeName}
          src={staffAvatars[leave.user_id]}
          profileId={leave.user_id}
          initials={getInitials(employeeName)}
          className="h-10 w-10 border text-xs shadow-xs"
        />
      }
      title={formatName(employeeName)}
      titleAside={
        <Badge variant="outline" className="text-xs font-medium">
          {leaveTypeName}
        </Badge>
      }
      description={
        <>
          <span>{employeeDept}</span>
          <span>•</span>
          <span>
            {safeDateDisplay(leave.start_date)} – {safeDateDisplay(leave.end_date)} ({leave.days_count}{" "}
            {leave.days_count === 1 ? "day" : "days"})
          </span>
        </>
      }
      badges={
        <>
          {getStageBadge(leave)}
          <StatusBadge
            status={isApproved ? "approved" : isRejected ? "rejected" : isCancelled ? "cancelled" : "pending"}
            label={leave.status}
            className="px-2 py-0.5 text-xs font-medium capitalize"
          />
        </>
      }
      footer={
        <>
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
                  className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive h-8 gap-1.5 text-xs"
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
        </>
      }
    >
      <div className="space-y-2.5">
        <LeaveStatusStrip leave={leave} />
        <LeaveOverlapNotice leave={leave} />
        {/* Dates and duration already live in the header */}
        <div className="pt-1">
          <LeaveDetailsList leave={leave} />
        </div>
      </div>
      <LeaveApprovalStages leave={leave} />
      <LeaveAttachments leave={leave} />
    </DetailSheet>
  )
}
