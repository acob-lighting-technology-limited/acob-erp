"use client"

import { Badge } from "@/components/ui/badge"
import { DetailSheet } from "@/components/ui/detail-sheet"
import { UserPlus, History, ArrowUpDown, AlertCircle, CheckCircle2, Calendar, FileText } from "lucide-react"
import type { Asset } from "@/app/admin/assets/admin-assets-content"
import { formatDateTime } from "@/lib/format"
import { EmptyState } from "@/components/ui/patterns/empty-state"

interface AssetActivity {
  id: string
  timestamp: string
  type: "assignment" | "unassignment" | "status_change" | "issue_reported" | "issue_resolved"
  title: string
  description?: string
  user_name?: string
  performed_by_name?: string
  details?: {
    assigned_to?: string
    department?: string
    office_location?: string
    assignment_type?: string
    notes?: string
    status?: string
    old_status?: string
  }
}

interface AssetHistorySheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  selectedAsset: Asset | null
  assetHistory: AssetActivity[]
}

function getStatusColor(status: string) {
  switch (status) {
    case "assigned":
      return "bg-success/15 text-success"
    case "available":
      return "bg-info/15 text-info"
    case "maintenance":
      return "bg-warning/15 text-warning"
    case "retired":
      return "bg-muted text-foreground"
    case "archived":
      return "bg-danger/15 text-danger"
    default:
      return "bg-muted text-foreground"
  }
}

export function AssetHistorySheet({ isOpen, onOpenChange, selectedAsset, assetHistory }: AssetHistorySheetProps) {
  return (
    <DetailSheet
      open={isOpen}
      onOpenChange={onOpenChange}
      title="Asset activity timeline"
      leading={<History className="text-primary h-5 w-5" />}
      description={`Assignments, status changes and issues for ${selectedAsset?.unique_code ?? "this asset"}`}
    >
      {assetHistory.length === 0 ? (
        <EmptyState compact title="No activity history found for this asset" />
      ) : (
        assetHistory.map((activity, index) => (
          <div key={activity.id} className={index === 0 ? "bg-primary/5 -mx-4 px-4 sm:-mx-5 sm:px-5" : undefined}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {activity.type === "assignment" && <UserPlus className="h-4 w-4 text-blue-500" />}
                {activity.type === "unassignment" && <History className="h-4 w-4 text-orange-500" />}
                {activity.type === "status_change" && <ArrowUpDown className="h-4 w-4 text-purple-500" />}
                {activity.type === "issue_reported" && <AlertCircle className="h-4 w-4 text-red-500" />}
                {activity.type === "issue_resolved" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                <span className="text-sm font-bold tracking-wide uppercase">{activity.title}</span>
              </div>
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Calendar className="h-3 w-3" />
                {formatDateTime(activity.timestamp, "-")}
              </div>
            </div>

            <div className="space-y-2">
              {activity.user_name && (
                <p className="text-sm">
                  <span className="text-muted-foreground">User/Location:</span>{" "}
                  <span className="text-foreground font-semibold">{activity.user_name}</span>
                </p>
              )}

              {activity.performed_by_name && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Performed by:</span>{" "}
                  <span className="text-foreground font-medium">{activity.performed_by_name}</span>
                </p>
              )}

              {activity.description && (
                <div className="bg-background/50 mt-2 rounded border p-3">
                  <p className="text-muted-foreground text-sm italic">&quot;{activity.description}&quot;</p>
                </div>
              )}

              {activity.details?.notes && (
                <div className="bg-background/50 mt-2 rounded border p-3">
                  <p className="text-foreground mb-1 flex items-center gap-1 text-xs font-semibold">
                    <FileText className="h-3 w-3" />
                    Notes:
                  </p>
                  <p className="text-muted-foreground text-sm">{activity.details.notes}</p>
                </div>
              )}

              {activity.details?.old_status && (
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="opacity-70">
                    {activity.details.old_status}
                  </Badge>
                  <ArrowUpDown className="text-muted-foreground h-3 w-3" />
                  <Badge className={getStatusColor(activity.details.status || "")}>{activity.details.status}</Badge>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </DetailSheet>
  )
}
