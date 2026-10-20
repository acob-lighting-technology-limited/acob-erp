"use client"

import { useState } from "react"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { Clock, Calendar, Pencil, AlertCircle, Download, Building, FileText } from "lucide-react"
import { useDepartmentCodes } from "@/hooks/use-department-code"
import { ClockTimes, NameWithDept } from "../_components/clock-times"
import { ExportOptionsDialog } from "@/components/admin/export-options-dialog"
import { toast } from "sonner"
import { toLocalISODate, formatWATDate } from "@/lib/utils/date"
import { isEarlyDeparture, getManualStatusEditOptions, isPermissionAttendanceStatus } from "@/lib/hr/attendance-status"
import { isLate } from "@/lib/hr/attendance-utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiFetch, apiJson } from "@/lib/api-client"
import { StatusBadge, labelSource } from "../_components/status-badge"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"

import { layout as tablePageLayout } from "./_layout"

interface AttendanceRecord {
  id: string
  user_id: string
  user_name: string
  department: string
  date: string
  clock_in: string | null
  clock_out: string | null
  total_hours: number | null
  status: string
  source: string | null
  manual_comment?: string | null
  editor_first_name?: string | null
}

function formatDate(dateString: string) {
  return formatWATDate(dateString, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
}

function formatTime(t: string | null) {
  if (!t) return "-"
  return t.substring(0, 5)
}

export function AdminAttendanceRecordsPage({
  backLinkHref,
  lockedDepartment,
}: { backLinkHref?: string; lockedDepartment?: string } = {}) {
  const deptCode = useDepartmentCodes()
  // Rows currently visible in the table (after search + filters + sort).
  const [processedRecords, setProcessedRecords] = useState<AttendanceRecord[]>([])
  const [filters, setFilters] = useState(() => ({
    start_date: toLocalISODate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
    end_date: toLocalISODate(),
  }))

  const [exportOpen, setExportOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null)
  const [editForm, setEditForm] = useState({ status: "", manual_comment: "" })
  const [saving, setSaving] = useState(false)
  const [reverting, setReverting] = useState(false)

  const {
    data: records = [],
    isLoading: loading,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEYS.attendanceRecords({ ...filters, lockedDepartment }),
    queryFn: async () => {
      const params = new URLSearchParams({ start_date: filters.start_date, end_date: filters.end_date })
      if (lockedDepartment) params.set("department", lockedDepartment)
      const payload = await apiJson<{ records?: AttendanceRecord[] }>(`/api/admin/hr/attendance/records?${params}`, {
        cache: "no-store",
      })
      return payload.records ?? []
    },
    placeholderData: keepPreviousData,
    meta: { errorMessage: "Failed to load records" },
  })
  const load = async (..._args: unknown[]) => {
    await refetch()
  }

  function openEdit(record: AttendanceRecord) {
    const clockIn = record.clock_in ?? null
    const clockOut = record.clock_out ?? null
    const hasClockIn = Boolean(clockIn)
    const hasClockOut = Boolean(clockOut)
    const hasAnyPunch = hasClockIn || hasClockOut

    const isLatePunch = hasClockIn && isLate(clockIn)
    const isEarlyOut = hasClockOut && isEarlyDeparture(clockOut as string)
    const isOnTimePresent = hasClockIn && hasClockOut && !isLatePunch && !isEarlyOut

    let initialStatus = ""
    if (!hasAnyPunch) {
      initialStatus = "absent_with_permission"
    } else if (!isOnTimePresent) {
      initialStatus = "lateness_with_permission"
    }

    setEditRecord(record)
    setEditForm({
      status:
        record.status && ["lateness_with_permission", "absent_with_permission"].includes(record.status)
          ? record.status
          : initialStatus,
      manual_comment: record.manual_comment ?? "",
    })
  }

  async function saveEdit() {
    if (!editRecord) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        waived: false,
        manual_comment: editForm.manual_comment,
        status: editForm.status,
      }

      const res = await apiFetch(`/api/admin/hr/attendance/records/${editRecord.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error || "Failed to save")
      toast.success("Record updated")
      setEditRecord(null)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handleRevert() {
    if (!editRecord) return
    setReverting(true)
    try {
      const res = await apiFetch(`/api/admin/hr/attendance/records/${editRecord.id}`, {
        method: "DELETE",
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error || "Failed to revert record")
      toast.success("Manual override removed — reverted to auto-derived attendance")
      setEditRecord(null)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revert record")
    } finally {
      setReverting(false)
    }
  }

  function downloadCSV() {
    const headers = ["Date", "Employee", "Department", "Clock In", "Clock Out", "Hours", "Status", "Source"]
    const source = processedRecords.length ? processedRecords : records
    const rows = source.map((r) => [
      formatDate(r.date),
      r.user_name,
      r.department,
      formatTime(r.clock_in),
      formatTime(r.clock_out),
      r.total_hours?.toFixed(2) ?? "-",
      r.status,
      r.source === "hikvision" ? "Device" : "Manual",
    ])
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${v}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `attendance-records-${filters.start_date}-to-${filters.end_date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const today = toLocalISODate()
  const incomplete = records.filter(
    (r) => r.status === "incomplete" || (r.date < today && Boolean(r.clock_in) && !r.clock_out)
  ).length
  const totalHours = records.reduce((s, r) => s + (r.total_hours ?? 0), 0)

  const columns: DataTableColumn<AttendanceRecord>[] = [
    {
      key: "date",
      label: "Date",
      sortable: true,
      accessor: (r) => r.date,
      render: (r) => <span className="font-medium">{formatDate(r.date)}</span>,
      initialWidth: 180,
    },
    {
      key: "user_name",
      label: "Employee",
      sortable: true,
      accessor: (r) => r.user_name,
      render: (r) => (
        <div>
          <div className="font-medium">{r.user_name}</div>
          <div className="text-muted-foreground text-xs">{r.department}</div>
        </div>
      ),
      initialWidth: 180,
    },
    {
      key: "clock_in",
      label: "Clock In",
      sortable: true,
      accessor: (r) => r.clock_in ?? "",
      hideOnMobile: true,
      render: (r) => (
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-green-600" />
          {formatTime(r.clock_in)}
        </span>
      ),
      align: "center",
    },
    {
      key: "clock_out",
      label: "Clock Out",
      sortable: true,
      accessor: (r) => r.clock_out ?? "",
      hideOnMobile: true,
      render: (r) =>
        r.clock_out ? (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-red-500" />
            {formatTime(r.clock_out)}
          </span>
        ) : (
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <AlertCircle className="h-3 w-3 text-orange-500" />
            Missing
          </span>
        ),
      align: "center",
    },
    {
      key: "total_hours",
      label: "Hours",
      sortable: true,
      accessor: (r) => r.total_hours ?? 0,
      render: (r) => (r.total_hours != null ? `${r.total_hours.toFixed(1)}h` : "-"),
      align: "center",
      hideOnMobile: true,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (r) => r.status,
      render: (r) => <StatusBadge status={r.status} record={r} />,
    },
    {
      key: "source",
      label: "Source",
      accessor: (r) => r.source ?? "",
      hideOnMobile: true,
      render: (r) => (
        <Badge variant={r.source === "hikvision" ? "secondary" : "outline"}>
          {r.source === "hikvision" ? "Device" : r.editor_first_name ? `Manual (${r.editor_first_name})` : "Manual"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      accessor: () => "",
      render: (r) => (
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={() => openEdit(r)} aria-label="Edit record">
                <Pencil className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Edit record</TooltipContent>
          </Tooltip>
        </div>
      ),
      align: "center",
    },
  ]

  const tableFilters: DataTableFilter<AttendanceRecord>[] = [
    {
      key: "status",
      label: "Status",
      options: [
        { value: "present", label: "Present" },
        { value: "late", label: "Late" },
        { value: "lateness_with_permission", label: "LWP" },
        { value: "incomplete_with_permission", label: "IWP" },
        { value: "incomplete", label: "Incomplete" },
        { value: "absent", label: "Absent" },
        { value: "absent_with_permission", label: "AWP" },
        { value: "out_of_station", label: "OOS" },
        { value: "exempted", label: "Exempted" },
        { value: "waiver", label: "Waiver" },
      ],
      placeholder: "All Statuses",
    },
    {
      key: "source",
      label: "Source",
      options: [
        { value: "hikvision", label: "Device" },
        { value: "manual", label: "Manual" },
      ],
      placeholder: "All Sources",
    },
  ]

  const { isOnTimePresent, options: statusOptions } = getManualStatusEditOptions(editRecord)
  const isOverridden = Boolean(
    editRecord &&
      (editRecord.source === "manual" ||
        Boolean(editRecord.manual_comment) ||
        isPermissionAttendanceStatus(editRecord.status))
  )

  const hasManualComment = editForm.manual_comment.trim().length >= 3
  const cannotSave = saving || !editForm.status || !hasManualComment || isOnTimePresent

  return (
    <>
      <DataTablePage
        layout={tablePageLayout}
        title="Attendance Records"
        description="View and fix individual attendance records."
        icon={Calendar}
        backLink={{ href: backLinkHref ?? "/admin/hr/attendance", label: "Back to Attendance" }}
        actions={
          <Button variant="outline" size="sm" onClick={() => setExportOpen(true)} disabled={records.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        }
        stats={
          <StatGrid>
            <StatCard variant="compact" title="Total Records" value={records.length} icon={Calendar} />
            <StatCard
              variant="compact"
              title="Missing Clock-Out"
              value={incomplete}
              icon={AlertCircle}
              iconBgColor="bg-orange-500/10"
              iconColor="text-orange-500"
            />
            <StatCard variant="compact" title="Total Hours" value={totalHours.toFixed(1)} icon={Clock} />
          </StatGrid>
        }
      >
        <div className="grid grid-cols-1 gap-4 rounded-xl border p-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters((f) => ({ ...f, start_date: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters((f) => ({ ...f, end_date: e.target.value }))}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={load} disabled={loading} className="w-full">
              {loading ? "Loading..." : "Apply"}
            </Button>
          </div>
        </div>

        <DataTable<AttendanceRecord>
          data={records}
          columns={columns}
          onProcessedDataChange={setProcessedRecords}
          filters={tableFilters}
          getRowId={(r) => r.id}
          pagination={{ pageSize: 50 }}
          searchPlaceholder="Search employee or department..."
          searchFn={(r, q) => [r.user_name, r.department].join(" ").toLowerCase().includes(q)}
          isLoading={loading}
          expandable={{
            render: (r) => (
              <div className="grid gap-3 p-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                <div className="bg-muted/20 rounded-lg border p-2.5">
                  <span className="text-muted-foreground block text-xs font-medium">Source</span>
                  <Badge variant="outline" className="mt-1 text-xs">
                    {labelSource(r.source || "") || "Unknown"}
                  </Badge>
                </div>

                <div className="bg-muted/20 rounded-lg border p-2.5">
                  <span className="text-muted-foreground block text-xs font-medium">Hours & Edits</span>
                  <p className="text-foreground mt-1">
                    Total: {r.total_hours != null ? `${r.total_hours.toFixed(1)}h` : "-"}
                    {r.editor_first_name && ` · Edited by ${r.editor_first_name}`}
                  </p>
                  {r.manual_comment && (
                    <p className="text-muted-foreground mt-1 italic">&ldquo;{r.manual_comment}&rdquo;</p>
                  )}
                </div>
              </div>
            ),
          }}
          viewToggle
          contactsView
          stickyToolbar
          defaultViewMode={{ mobile: "contacts", desktop: "list" }}
          mobileRow={{
            title: (r) => <NameWithDept name={r.user_name} code={deptCode(r.department)} />,
            subtitle: (r) => (
              <>
                <ClockTimes clockIn={r.clock_in} clockOut={r.clock_out} />
                {` · ${r.total_hours?.toFixed(1) ?? 0}h · ${formatDate(r.date)}`}
              </>
            ),
            trailing: (r) => <StatusBadge status={r.status} record={r} />,
            detail: {
              title: (r) => r.user_name,
              subtitle: (r) =>
                `${r.department} · ${formatWATDate(r.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}`,
              badges: (r) => <StatusBadge status={r.status} record={r} />,
              fields: (r) => [
                { icon: Building, label: "Department", value: r.department },
                {
                  icon: Calendar,
                  label: "Date",
                  value: formatWATDate(r.date, { day: "numeric", month: "short", year: "numeric" }),
                },
                { icon: Clock, label: "Clock In", value: formatTime(r.clock_in) },
                { icon: Clock, label: "Clock Out", value: formatTime(r.clock_out) },
                ...(r.total_hours != null
                  ? [{ icon: Clock, label: "Total Hours", value: `${r.total_hours.toFixed(2)} hrs` }]
                  : []),
                ...(r.source ? [{ icon: FileText, label: "Source", value: labelSource(r.source) }] : []),
              ],
              actions: (r) => [
                {
                  label: "Edit Record",
                  icon: Pencil,
                  onClick: () => openEdit(r),
                },
              ],
            },
          }}
          cardRenderer={(r) => (
            <div className="bg-card space-y-3 rounded-xl border p-4 text-xs transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold">{r.user_name}</p>
                  <p className="text-muted-foreground text-xs">{r.department}</p>
                </div>
                <StatusBadge status={r.status} record={r} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Clock In:</span> {formatTime(r.clock_in)}
                </div>
                <div>
                  <span className="text-muted-foreground">Clock Out:</span> {formatTime(r.clock_out)}
                </div>
              </div>
              <div className="flex items-center justify-between border-t pt-2 text-xs">
                <span>{formatDate(r.date)}</span>
                <span className="font-semibold">{r.total_hours?.toFixed(1) ?? 0} hrs</span>
              </div>
            </div>
          )}
          emptyTitle="No records found"
          emptyDescription="Adjust the date range and try again."
          emptyIcon={Calendar}
          skeletonRows={8}
        />
      </DataTablePage>

      <ExportOptionsDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        options={[{ id: "csv", label: "CSV (.csv)", icon: "excel" }]}
        onSelect={() => {
          downloadCSV()
          setExportOpen(false)
        }}
      />

      <Dialog open={!!editRecord} onOpenChange={(open) => !open && setEditRecord(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Attendance Record</DialogTitle>
            <DialogDescription>
              {editRecord && `${editRecord.user_name} — ${formatDate(editRecord.date)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {isOnTimePresent && !isOverridden ? (
              <p className="text-muted-foreground text-sm">
                This record is fully present and on-time. No overrides (LWP/AWP) are applicable.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value) => setEditForm((f) => ({ ...f, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status..." />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>
                    Comment (required) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={editForm.manual_comment}
                    onChange={(e) => setEditForm((f) => ({ ...f, manual_comment: e.target.value }))}
                    placeholder="Reason for this manual attendance change"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            {isOverridden ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleRevert}
                disabled={reverting || saving}
              >
                {reverting ? "Reverting…" : "Revert Override"}
              </Button>
            ) : (
              <div />
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditRecord(null)} disabled={saving || reverting}>
                Cancel
              </Button>
              {(!isOnTimePresent || !isOverridden) && (
                <Button onClick={saveEdit} disabled={cannotSave || reverting}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
