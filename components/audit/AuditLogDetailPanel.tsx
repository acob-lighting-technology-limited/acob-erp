"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calendar, User } from "lucide-react"
import { getAuditActionColor } from "@/lib/audit/action-colors"
import { getNormalizedEntityTypeDisplay } from "@/lib/audit/entity-type-display"
import { getActionDisplay, formatAuditDate, getPerformedBy, getTargetDescription } from "@/lib/audit/audit-log-display"
import { formatName } from "@/lib/utils"
import type { AuditLog } from "@/app/admin/audit-logs/types"

interface AuditLogDetailPanelProps {
  log: AuditLog | null
  open: boolean
  onClose: () => void
}

export function AuditLogDetailPanel({ log, open, onClose }: AuditLogDetailPanelProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Audit Log Details</DialogTitle>
          <DialogDescription>Complete information about this audit event</DialogDescription>
        </DialogHeader>

        {log && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Action</Label>
                <div>
                  <Badge className={getAuditActionColor(log.action)}>{getActionDisplay(log)}</Badge>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Entity Type</Label>
                <div className="text-sm font-medium">{getNormalizedEntityTypeDisplay(log.entity_type)}</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Target/Affected</Label>
              <div className="bg-muted/50 rounded-lg border p-3">
                <p className="text-sm font-medium">{getTargetDescription(log)}</p>
                {log.target_user && (
                  <p className="text-muted-foreground mt-1 text-xs">{log.target_user.company_email}</p>
                )}
                {log.task_info && (
                  <div className="mt-2 border-t pt-2">
                    <p className="text-muted-foreground text-xs">Task: {log.task_info.title}</p>
                    {log.task_info.assigned_to_user && (
                      <p className="text-muted-foreground text-xs">
                        Assigned to: {formatName(log.task_info.assigned_to_user.first_name)}{" "}
                        {formatName(log.task_info.assigned_to_user.last_name)}
                      </p>
                    )}
                  </div>
                )}
                {log.device_info && (
                  <div className="mt-2 border-t pt-2">
                    <p className="text-muted-foreground text-xs">Device: {log.device_info.device_name}</p>
                    {log.device_info.assigned_to_user && (
                      <p className="text-muted-foreground text-xs">
                        Assigned to: {formatName(log.device_info.assigned_to_user.first_name)}{" "}
                        {formatName(log.device_info.assigned_to_user.last_name)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Performed By</Label>
              <div className="bg-muted/50 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <User className="text-muted-foreground h-4 w-4" />
                  <span
                    className={`text-sm font-medium ${log.entity_type === "feedback" && log.new_values?.is_anonymous ? "text-muted-foreground italic" : ""}`}
                  >
                    {getPerformedBy(log)}
                  </span>
                </div>
                {!(log.entity_type === "feedback" && log.new_values?.is_anonymous) && (
                  <p className="text-muted-foreground mt-1 text-xs">{log.user?.company_email}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Date &amp; Time</Label>
              <div className="bg-muted/50 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Calendar className="text-muted-foreground h-4 w-4" />
                  <span className="text-sm">{formatAuditDate(log.created_at)}</span>
                </div>
              </div>
            </div>

            {log.old_values && Object.keys(log.old_values).length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Old Values</Label>
                <div className="bg-muted/50 max-h-60 overflow-auto rounded-lg border p-4">
                  <pre className="font-mono text-xs whitespace-pre-wrap">{JSON.stringify(log.old_values, null, 2)}</pre>
                </div>
              </div>
            )}

            {log.new_values && Object.keys(log.new_values).length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">New Values</Label>
                <div className="bg-muted/50 max-h-60 overflow-auto rounded-lg border p-4">
                  <pre className="font-mono text-xs whitespace-pre-wrap">{JSON.stringify(log.new_values, null, 2)}</pre>
                </div>
              </div>
            )}

            {log.entity_id && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Entity ID</Label>
                <div className="bg-muted/50 rounded-lg border p-3">
                  <code className="font-mono text-xs break-all">{log.entity_id}</code>
                </div>
              </div>
            )}

            <div className="flex gap-2 border-t pt-4">
              <Button onClick={onClose} variant="outline" className="flex-1">
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
