"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TableSkeleton } from "@/components/ui/query-states"
import { WeeklyReportTableRow } from "./weekly-report-table-row"
import type { WeeklyReport } from "@/lib/export-utils"

interface TrackerStatus {
  id: string
  department: string
  status: string
}

interface WeeklyReportTableProps {
  loading: boolean
  filteredReports: WeeklyReport[]
  meetingDate: string
  expandedRows: Set<string>
  trackingData: TrackerStatus[]
  isFilteredWeekLocked: boolean
  canMutateReport: (report: WeeklyReport) => boolean
  onToggleRow: (id: string) => void
  onEdit: (report: WeeklyReport) => void
  onDelete: (id: string) => void
  onExportPptx: (report: WeeklyReport) => void
}

export function WeeklyReportTable({
  loading,
  filteredReports,
  meetingDate,
  expandedRows,
  trackingData,
  isFilteredWeekLocked,
  canMutateReport,
  onToggleRow,
  onEdit,
  onDelete,
  onExportPptx,
}: WeeklyReportTableProps) {
  return (
    <div className="bg-background dark:bg-card overflow-hidden rounded-lg border shadow-sm">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="text-muted-foreground w-[40px]"></TableHead>
            <TableHead className="text-foreground font-bold">Department</TableHead>
            <TableHead className="text-foreground font-bold">Meeting Date</TableHead>
            <TableHead className="text-foreground font-bold">Week</TableHead>
            <TableHead className="text-foreground font-bold">Submitted By</TableHead>
            <TableHead className="text-foreground font-bold">Submission Date</TableHead>
            <TableHead className="text-foreground text-center font-bold">Action Tracker</TableHead>
            <TableHead className="text-foreground text-right font-bold">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={8} className="p-4">
                <TableSkeleton rows={4} cols={8} />
              </TableCell>
            </TableRow>
          ) : filteredReports.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-muted-foreground h-32 text-center font-medium">
                No records found for the selected criteria.
              </TableCell>
            </TableRow>
          ) : (
            filteredReports.map((report) => (
              <WeeklyReportTableRow
                key={report.id}
                report={report}
                meetingDate={meetingDate}
                isExpanded={expandedRows.has(report.id)}
                onToggle={() => onToggleRow(report.id)}
                trackingData={trackingData}
                isFilteredWeekLocked={isFilteredWeekLocked}
                canMutateReport={canMutateReport}
                onEdit={onEdit}
                onDelete={onDelete}
                onExportPptx={onExportPptx}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
