"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Eye } from "lucide-react"
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

interface AuditLogTableProps {
  logs: AuditLog[]
  onViewDetails: (log: AuditLog) => void
}

export function AuditLogTable({ logs, onViewDetails }: AuditLogTableProps) {
  return (
    <Card className="border-2">
      <div className="table-responsive">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Object</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Dept/Location</TableHead>
              <TableHead>By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log, index) => (
              <TableRow key={log.id}>
                <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                <TableCell>
                  <Badge className={getAuditActionColor(log.action)}>{getActionDisplay(log)}</Badge>
                </TableCell>
                <TableCell>
                  <span className="text-foreground text-sm font-medium">
                    {getNormalizedEntityTypeDisplay(log.entity_type)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-foreground font-mono text-sm">{getObjectIdentifier(log)}</span>
                </TableCell>
                <TableCell>
                  <span className="text-foreground text-sm">{getTargetDescription(log)}</span>
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground text-sm">{getDepartmentLocation(log)}</span>
                </TableCell>
                <TableCell>
                  <span
                    className={`text-sm ${log.entity_type === "feedback" && log.new_values?.is_anonymous ? "text-muted-foreground italic" : "text-foreground"}`}
                  >
                    {getPerformedBy(log)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground text-sm">{formatAuditDate(log.created_at)}</span>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewDetails(log)}
                    aria-label="View audit log details"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}
