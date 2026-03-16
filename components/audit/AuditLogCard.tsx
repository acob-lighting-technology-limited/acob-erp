"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Eye, User } from "lucide-react"
import { getAuditActionColor } from "@/lib/audit/action-colors"
import { getNormalizedEntityTypeDisplay } from "@/lib/audit/entity-type-display"
import {
  getActionDisplay,
  formatAuditDate,
  getPerformedBy,
  getObjectIdentifier,
  getTargetDescription,
  getDepartmentLocation,
} from "@/lib/audit/audit-log-display"
import type { AuditLog } from "@/app/admin/audit-logs/types"

interface AuditLogCardProps {
  log: AuditLog
  onViewDetails: (log: AuditLog) => void
}

function FormatValues({ values }: { values: Record<string, unknown> }) {
  try {
    return (
      <div className="bg-muted/50 mt-2 rounded-lg p-3">
        <pre className="text-muted-foreground overflow-x-auto text-xs">{JSON.stringify(values, null, 2)}</pre>
      </div>
    )
  } catch {
    return null
  }
}

export function AuditLogCard({ log, onViewDetails }: AuditLogCardProps) {
  const deptLocation = getDepartmentLocation(log)

  return (
    <Card className="border-2 transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className={getAuditActionColor(log.action)}>{getActionDisplay(log)}</Badge>
              <span className="text-foreground text-sm font-medium">
                {getNormalizedEntityTypeDisplay(log.entity_type)}
              </span>
              <span className="text-primary font-mono text-sm">{getObjectIdentifier(log)}</span>
              <span className="text-muted-foreground">→</span>
              <span className="text-foreground text-sm">{getTargetDescription(log)}</span>
              {deptLocation !== "-" && (
                <>
                  <span className="text-muted-foreground">|</span>
                  <span className="text-muted-foreground text-sm">{deptLocation}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <User className="text-muted-foreground h-4 w-4" />
                <span className="text-muted-foreground">By:</span>
                <span
                  className={`${log.entity_type === "feedback" && log.new_values?.is_anonymous ? "text-muted-foreground italic" : "text-foreground"}`}
                >
                  {getPerformedBy(log)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="text-muted-foreground h-4 w-4" />
                <span className="text-muted-foreground">{formatAuditDate(log.created_at)}</span>
              </div>
            </div>

            {log.old_values && Object.keys(log.old_values).length > 0 && (
              <details className="mt-2">
                <summary className="text-foreground hover:text-primary cursor-pointer text-sm font-medium">
                  Old Values
                </summary>
                <FormatValues values={log.old_values} />
              </details>
            )}

            {log.new_values && Object.keys(log.new_values).length > 0 && (
              <details className="mt-2">
                <summary className="text-foreground hover:text-primary cursor-pointer text-sm font-medium">
                  New Values
                </summary>
                <FormatValues values={log.new_values} />
              </details>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewDetails(log)}
            className="gap-2"
            aria-label="View audit log details"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
