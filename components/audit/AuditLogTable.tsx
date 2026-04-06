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
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-foreground w-12 font-bold">#</TableHead>
              <TableHead className="text-foreground font-bold">Action</TableHead>
              <TableHead className="text-foreground font-bold">Module</TableHead>
              <TableHead className="text-foreground font-bold">Object</TableHead>
              <TableHead className="text-foreground font-bold">Target</TableHead>
              <TableHead className="text-foreground font-bold">Dept/Location</TableHead>
              <TableHead className="text-foreground font-bold">By</TableHead>
              <TableHead className="text-foreground font-bold">Date</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log, index) => (
              <TableRow key={log.id}>
                <TableCell className="text-muted-foreground py-4 font-medium">{index + 1}</TableCell>
                <TableCell className="py-4">
                  <Badge className={getAuditActionColor(log.action)}>{getActionDisplay(log)}</Badge>
                </TableCell>
                <TableCell className="py-4">
                  <span className="text-foreground text-sm font-medium">
                    {getNormalizedEntityTypeDisplay(log.entity_type)}
                  </span>
                </TableCell>
                <TableCell className="py-4">
                  <span className="text-foreground font-mono text-sm">{getObjectIdentifier(log)}</span>
                </TableCell>
                <TableCell className="py-4">
                  <span className="text-foreground text-sm">{getTargetDescription(log)}</span>
                </TableCell>
                <TableCell className="py-4">
                  <span className="text-muted-foreground text-sm">{getDepartmentLocation(log)}</span>
                </TableCell>
                <TableCell className="py-4">
                  <span
                    className={`text-sm ${log.entity_type === "feedback" && log.new_values?.is_anonymous ? "text-muted-foreground italic" : "text-foreground"}`}
                  >
                    {getPerformedBy(log)}
                  </span>
                </TableCell>
                <TableCell className="py-4">
                  <span className="text-muted-foreground text-sm">{formatAuditDate(log.created_at)}</span>
                </TableCell>
                <TableCell className="py-4">
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
