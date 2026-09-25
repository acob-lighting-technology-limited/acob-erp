"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ClipboardEdit, Download, PlusCircle, RotateCcw, Target, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter, DataTableTab } from "@/components/ui/data-table"
import { ExportOptionsDialog } from "@/components/admin/export-options-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { Textarea } from "@/components/ui/textarea"
import { apiFetch } from "@/lib/api-client"
import { averageCappedPct, ragStatus, type RagStatus } from "@/lib/corporate-scorecard/attainment"
import { formatWATDate } from "@/lib/utils/date"
import { exportDepartmentCascadeToExcel, exportDepartmentCascadeToPdf } from "@/lib/corporate-scorecard/export"

type CascadeRow = {
  assignment_id: string
  kpi_id: string
  department?: string
  source_sn: number
  perspective: string
  strategic_priority?: string
  strategic_objective: string
  measure: string
  target_text: string
  measure_type: "count" | "percentage" | "currency" | "milestone"
  direction: "at_least" | "at_most"
  role: "core" | "support"
  target_value: number | null
  target_unit: string | null
  department_target: string | null
  proposed_action: string | null
  latest_actual: {
    actual_value: number | null
    milestones_completed: number | null
    milestones_total: number | null
    note: string | null
    recorded_at: string
    is_override?: boolean
  } | null
  effective_actual?: number | null
  effective_milestones_completed?: number | null
  effective_milestones_total?: number | null
  source?: "auto" | "manual" | "none"
  is_override?: boolean
  task_stats?: {
    total: number
    completed: number
    inProgress: number
  } | null
  raw_pct: number | null
  capped_pct: number | null
}

function ragBadge(status: RagStatus | null) {
  if (status === "green")
    return <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500">On Target</Badge>
  if (status === "amber")
    return <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-500">Needs Attention</Badge>
  if (status === "red") return <Badge className="border-red-500/20 bg-red-500/10 text-red-500">At Risk</Badge>
  return <span className="text-muted-foreground text-xs">No data</span>
}

/**
 * One department's scorecard cascade: every KPI it is CORE or SUPPORT on,
 * each with its own numeric target and recorded progress. Only CORE rows
 * count toward the department's own scorecard number — SUPPORT is here for
 * visibility, per the agreed rule that a department is not judged on work it
 * merely contributes to.
 */
export interface DepartmentCascadeContentProps {
  departments: string[]
  initialDepartment: string | null
  lockedDepartment?: string
  backLink?: { href: string; label: string }
  isReadOnly?: boolean
  tabs?: DataTableTab[]
  activeTab?: string
  onTabChange?: (tab: string) => void
  onDepartmentChange?: (dept: string) => void
}

export function DepartmentCascadeContent({
  departments,
  initialDepartment,
  lockedDepartment,
  backLink,
  isReadOnly,
  tabs,
  activeTab,
  onTabChange,
  onDepartmentChange,
}: DepartmentCascadeContentProps) {
  const queryClient = useQueryClient()
  const activeDepartment = lockedDepartment || initialDepartment || departments[0] || ""
  const [department, setDepartment] = useState(activeDepartment)
  const [editingRow, setEditingRow] = useState<CascadeRow | null>(null)
  const [recordingRow, setRecordingRow] = useState<CascadeRow | null>(null)
  const [isExportOpen, setIsExportOpen] = useState(false)

  const [filterValues, setFilterValues] = useState<Record<string, string[]>>(() => ({
    ...(!lockedDepartment && department && department !== "all" ? { department: [department] } : {}),
  }))

  const handleFilterValuesChange = useCallback(
    (nextFilters: Record<string, string[]>) => {
      setFilterValues(nextFilters)
      const nextDept = nextFilters.department?.[0]
      if (nextDept) {
        if (nextDept !== department) {
          setDepartment(nextDept)
          onDepartmentChange?.(nextDept)
        }
      } else {
        if (department !== "all") {
          setDepartment("all")
          onDepartmentChange?.("all")
        }
      }
    },
    [department, onDepartmentChange]
  )

  useEffect(() => {
    if (lockedDepartment && department !== lockedDepartment) {
      setDepartment(lockedDepartment)
    }
  }, [lockedDepartment, department])

  useEffect(() => {
    if (!lockedDepartment && department) {
      setFilterValues((prev) => {
        const currentInFilter = prev.department?.[0]
        if (department === "all" && currentInFilter) {
          const { department: _, ...rest } = prev
          return rest
        }
        if (department !== "all" && currentInFilter !== department) {
          return { ...prev, department: [department] }
        }
        return prev
      })
    }
  }, [department, lockedDepartment])

  const queryKey = ["corporate-scorecard-department", department]

  const { data, isLoading, error, refetch } = useQuery<{ data: CascadeRow[] }>({
    queryKey,
    queryFn: async () => {
      const res = await apiFetch(`/api/corporate-scorecard/departments/${encodeURIComponent(department)}`, {
        cache: "no-store",
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to load this department's scorecard")
      return payload
    },
    enabled: Boolean(department),
  })

  const rows = useMemo(() => data?.data ?? [], [data])
  const coreRows = useMemo(() => rows.filter((r) => r.role === "core"), [rows])

  const departmentAttainment = useMemo(() => averageCappedPct(coreRows.map((r) => r.capped_pct)), [coreRows])
  const recordedCount = coreRows.filter(
    (r) => r.latest_actual !== null || (r.source === "auto" && r.capped_pct !== null)
  ).length

  const pillarOptions = useMemo(() => {
    const set = new Set<string>()
    for (const row of rows) {
      if (row.strategic_priority) set.add(row.strategic_priority)
    }
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value, label: value }))
  }, [rows])

  const columns = useMemo<DataTableColumn<CascadeRow>[]>(
    () => [
      ...(department === "all"
        ? [
            {
              key: "department",
              label: "Department",
              sortable: true,
              accessor: (r: CascadeRow) => r.department || "",
              render: (r: CascadeRow) => (
                <Badge variant="outline" className="text-xs font-medium">
                  {r.department}
                </Badge>
              ),
            },
          ]
        : []),
      {
        key: "strategic_priority",
        label: "Pillar",
        sortable: true,
        resizable: true,
        initialWidth: 170,
        accessor: (r) => r.strategic_priority || "",
        render: (r) =>
          r.strategic_priority ? (
            <Badge variant="secondary" className="text-left text-[11px] font-medium whitespace-normal">
              {r.strategic_priority}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">-</span>
          ),
      },
      {
        key: "measure",
        label: "KPI Measure",
        sortable: true,
        resizable: true,
        initialWidth: 300,
        accessor: (r) => r.measure,
        render: (r) => (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs leading-snug font-medium">{r.measure}</span>
            <span className="text-muted-foreground text-[11px]">{r.strategic_objective}</span>
          </div>
        ),
      },
      {
        key: "perspective",
        label: "Perspective",
        sortable: true,
        accessor: (r) => r.perspective,
        render: (r) => (
          <Badge variant="outline" className="text-xs">
            {r.perspective}
          </Badge>
        ),
      },
      {
        key: "role",
        label: "Role",
        sortable: true,
        accessor: (r) => r.role,
        render: (r) =>
          r.role === "core" ? (
            <Badge className="border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-600">CORE</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              SUPPORT
            </Badge>
          ),
      },
      {
        key: "target_value",
        label: "Target",
        accessor: (r) => r.department_target || r.target_text || (r.target_value != null ? String(r.target_value) : ""),
        render: (r) => {
          const targetDisplay =
            r.department_target ||
            r.target_text ||
            (r.target_value != null ? `${r.target_value} ${r.target_unit || ""}`.trim() : null)
          if (!targetDisplay) return <span className="text-xs text-amber-600 dark:text-amber-400">Not set</span>
          return (
            <div className="flex flex-col">
              <span className="text-xs font-medium">{targetDisplay}</span>
              {r.department_target && r.target_text && r.department_target !== r.target_text ? (
                <span className="text-muted-foreground text-[10px]">Corp: {r.target_text}</span>
              ) : null}
            </div>
          )
        },
      },
      {
        key: "actual",
        label: "Actual",
        accessor: (r) => r.effective_actual ?? r.latest_actual?.actual_value ?? -1,
        render: (r) => {
          let actualDisplay: string | null = null
          if (r.measure_type === "milestone") {
            const completed = r.effective_milestones_completed ?? r.latest_actual?.milestones_completed
            const total = r.effective_milestones_total ?? r.latest_actual?.milestones_total
            if (completed != null) actualDisplay = `${completed} / ${total ?? 3} ms`
          } else if (r.effective_actual != null) {
            actualDisplay = `${r.effective_actual} ${r.target_unit || ""}`.trim()
          } else if (r.latest_actual?.actual_value != null) {
            actualDisplay = `${r.latest_actual.actual_value} ${r.target_unit || ""}`.trim()
          }

          if (!actualDisplay) return <span className="text-muted-foreground text-xs">No data</span>

          return (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium">{actualDisplay}</span>
              {r.source === "auto" && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                  <Zap className="h-3 w-3" />
                  Auto ({r.task_stats?.completed || 0} tasks)
                </span>
              )}
              {r.source === "manual" && r.is_override && (
                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">✏️ Adjusted</span>
              )}
            </div>
          )
        },
      },
      {
        key: "capped_pct",
        label: "Attainment",
        sortable: true,
        accessor: (r) => r.capped_pct ?? -1,
        render: (r) =>
          r.capped_pct == null ? (
            <span className="text-muted-foreground text-xs">-</span>
          ) : (
            <div className="w-28 space-y-1">
              <Progress value={r.capped_pct} />
              <span className="text-muted-foreground text-[11px]">
                {r.raw_pct}% {r.raw_pct !== r.capped_pct ? "(capped at 100 for rollup)" : ""}
              </span>
            </div>
          ),
      },
      {
        key: "status",
        label: "Status",
        accessor: (r) => r.capped_pct ?? -1,
        render: (r) => ragBadge(r.capped_pct != null ? ragStatus(r.capped_pct) : null),
      },
    ],
    [department]
  )

  const filters = useMemo<DataTableFilter<CascadeRow>[]>(
    () => [
      ...(!lockedDepartment && departments.length > 0
        ? [
            {
              key: "department",
              label: "Department",
              options: departments.map((d) => ({ value: d, label: d })),
              multi: false,
              filterFn: (row: CascadeRow, selected: string[]) => {
                if (!selected || selected.length === 0) return true
                return selected.includes(row.department || department)
              },
            },
          ]
        : []),
      {
        key: "role",
        label: "Role",
        options: [
          { value: "core", label: "CORE (scored)" },
          { value: "support", label: "SUPPORT" },
        ],
      },
      {
        key: "perspective",
        label: "Perspective",
        options: [
          { value: "Financial", label: "Financial" },
          { value: "Customer", label: "Customer" },
          { value: "Internal Process", label: "Internal Process" },
          { value: "Organizational Capacity", label: "Organizational Capacity" },
        ],
      },
      {
        key: "strategic_priority",
        label: "Strategic Pillar",
        options: pillarOptions,
      },
    ],
    [departments, lockedDepartment, department, pillarOptions]
  )

  return (
    <DataTablePage
      title={tabs ? "Corporate Scorecard" : "Department KPIs"}
      description="Each department's assigned KPIs, confirmed targets, proposed action plans, and recorded actual progress against the 2026 plan."
      icon={Target}
      backLink={backLink || { href: "/admin", label: "Back to Admin" }}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsExportOpen(true)}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          {lockedDepartment && (
            <Badge
              variant="outline"
              className="border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600"
            >
              {lockedDepartment}
            </Badge>
          )}
        </div>
      }
      stats={
        <StatGrid>
          <StatCard
            variant="compact"
            title="Department Attainment"
            value={departmentAttainment != null ? `${departmentAttainment}%` : "No data"}
            icon={Target}
            description={department === "all" ? "All Departments (CORE)" : "CORE KPIs only"}
          />
          <StatCard variant="compact" title="CORE KPIs" value={coreRows.length} description="Scored" />
          <StatCard
            variant="compact"
            title="SUPPORT KPIs"
            value={rows.length - coreRows.length}
            description="Visible, not scored"
          />
          <StatCard
            variant="compact"
            title="Active / Tracked"
            value={`${recordedCount}/${coreRows.length}`}
            description="CORE KPIs with live or manual actual"
          />
        </StatGrid>
      }
    >
      <DataTable<CascadeRow>
        data={rows}
        columns={columns}
        filters={filters}
        filterValues={filterValues}
        onFilterValuesChange={handleFilterValuesChange}
        getRowId={(r) => r.assignment_id}
        searchPlaceholder="Search KPI or objective..."
        searchFn={(row, query) =>
          `${row.measure} ${row.strategic_objective} ${row.strategic_priority || ""}`
            .toLowerCase()
            .includes(query.toLowerCase())
        }
        isLoading={isLoading}
        error={error instanceof Error ? error.message : null}
        onRetry={refetch}
        emptyTitle="No KPIs for This Department"
        emptyDescription="This department has no CORE or SUPPORT role on any corporate KPI yet."
        emptyIcon={Target}
        rowActions={
          isReadOnly
            ? undefined
            : [
                { label: "Edit Target", icon: ClipboardEdit, onClick: (r) => setEditingRow(r) },
                { label: "Record / Override Actual", icon: PlusCircle, onClick: (r) => setRecordingRow(r) },
              ]
        }
        expandable={{
          render: (r) => (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Corporate Target</p>
                <p className="mt-1 text-sm">{r.target_text}</p>
                <p className="text-muted-foreground mt-3 text-xs font-semibold tracking-wide uppercase">
                  This Department&apos;s Target
                </p>
                <p className="mt-1 text-sm">{r.department_target || "Not yet confirmed"}</p>
                {r.task_stats && r.task_stats.total > 0 && (
                  <div className="mt-3 rounded-md border border-blue-500/20 bg-blue-500/5 p-2 text-xs">
                    <p className="flex items-center gap-1 text-[10px] font-semibold text-blue-700 uppercase dark:text-blue-300">
                      <Zap className="h-3 w-3" /> Live Task Breakdown
                    </p>
                    <p className="mt-0.5 text-blue-900 dark:text-blue-100">
                      {r.task_stats.completed} completed · {r.task_stats.inProgress} in progress · {r.task_stats.total}{" "}
                      total linked tasks
                    </p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Proposed Action</p>
                <p className="mt-1 text-sm">{r.proposed_action || "Not yet defined"}</p>
                {r.latest_actual && (
                  <>
                    <p className="text-muted-foreground mt-3 text-xs font-semibold tracking-wide uppercase">
                      Latest Recorded Actual
                    </p>
                    <p className="mt-1 text-sm">{r.latest_actual.note || "No note recorded"}</p>
                    <p className="text-muted-foreground mt-1 text-[11px]">
                      Recorded {formatWATDate(r.latest_actual.recorded_at)}
                      {r.is_override ? " (Manual Override)" : ""}
                    </p>
                  </>
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
          title: (r) => r.measure,
          subtitle: (r) =>
            `${r.role.toUpperCase()} · ${r.perspective} · Attainment: ${r.capped_pct != null ? `${r.capped_pct}%` : "-"}`,
          trailing: (r) => ragBadge(r.capped_pct != null ? ragStatus(r.capped_pct) : null),
          onSelect: (r) => setEditingRow(r),
        }}
        cardRenderer={(r) => (
          <div
            className="bg-card cursor-pointer space-y-3 rounded-xl border p-4 text-xs transition-shadow hover:shadow-md"
            onClick={() => setEditingRow(r)}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold">{r.measure}</p>
                <p className="text-muted-foreground text-xs">{r.perspective}</p>
              </div>
              {ragBadge(r.capped_pct != null ? ragStatus(r.capped_pct) : null)}
            </div>
            <p className="text-muted-foreground line-clamp-2 text-xs">{r.strategic_objective}</p>
            <div className="flex items-center justify-between border-t pt-2 text-[10px]">
              <span>Role: {r.role.toUpperCase()}</span>
              <span>Attainment: {r.capped_pct != null ? `${r.capped_pct}%` : "-"}</span>
            </div>
          </div>
        )}
        urlSync
      />

      <EditTargetDialog
        row={editingRow}
        onOpenChange={(open) => !open && setEditingRow(null)}
        onSaved={() => {
          setEditingRow(null)
          void queryClient.invalidateQueries({ queryKey })
        }}
      />

      <RecordActualDialog
        row={recordingRow}
        department={recordingRow?.department || department}
        onOpenChange={(open) => !open && setRecordingRow(null)}
        onSaved={() => {
          setRecordingRow(null)
          void queryClient.invalidateQueries({ queryKey })
        }}
      />

      <ExportOptionsDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        title={`Export ${department === "all" ? "All Departments" : department} KPIs`}
        options={[
          { id: "excel", label: "Excel (.xlsx)", icon: "excel" },
          { id: "pdf", label: "PDF", icon: "pdf" },
        ]}
        onSelect={(id) => {
          if (id === "excel") void exportDepartmentCascadeToExcel(rows, department)
          else if (id === "pdf") void exportDepartmentCascadeToPdf(rows, department)
        }}
      />
    </DataTablePage>
  )
}

function EditTargetDialog({
  row,
  onOpenChange,
  onSaved,
}: {
  row: CascadeRow | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [targetValue, setTargetValue] = useState("")
  const [targetUnit, setTargetUnit] = useState("")
  const [departmentTarget, setDepartmentTarget] = useState("")
  const [proposedAction, setProposedAction] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const open = row !== null

  useEffect(() => {
    if (!row) return
    setTargetValue(row.target_value != null ? String(row.target_value) : "")
    setTargetUnit(row.target_unit || "")
    setDepartmentTarget(row.department_target || "")
    setProposedAction(row.proposed_action || "")
  }, [row])

  async function handleSave() {
    if (!row) return
    setIsSaving(true)
    try {
      const res = await apiFetch(`/api/corporate-scorecard/assignments/${row.assignment_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_value: targetValue.trim() ? Number(targetValue) : null,
          target_unit: targetUnit.trim() || null,
          department_target: departmentTarget.trim() || null,
          proposed_action: proposedAction.trim() || null,
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to save")
      toast.success("Target updated")
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Confirm This Department&apos;s Target</DialogTitle>
          <DialogDescription>{row?.measure}</DialogDescription>
        </DialogHeader>

        {row?.measure_type === "milestone" ? (
          <p className="text-muted-foreground text-sm">
            Milestone KPIs are tracked by milestones completed, not a numeric target — record progress from the
            &ldquo;Record Actual&rdquo; action instead.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Target value</Label>
              <Input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="e.g. 5"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Unit</Label>
              <Input
                value={targetUnit}
                onChange={(e) => setTargetUnit(e.target.value)}
                placeholder="e.g. projects, %"
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">In your own words (optional)</Label>
          <Textarea
            value={departmentTarget}
            onChange={(e) => setDepartmentTarget(e.target.value)}
            placeholder="This department's commitment toward the corporate target..."
            className="min-h-[60px] text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Proposed Action (optional)</Label>
          <Textarea
            value={proposedAction}
            onChange={(e) => setProposedAction(e.target.value)}
            placeholder="What & how this department will achieve it..."
            className="min-h-[60px] text-xs"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RecordActualDialog({
  row,
  department,
  onOpenChange,
  onSaved,
}: {
  row: CascadeRow | null
  department: string
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [actualValue, setActualValue] = useState("")
  const [milestonesCompleted, setMilestonesCompleted] = useState("")
  const [milestonesTotal, setMilestonesTotal] = useState("3")
  const [note, setNote] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const open = row !== null
  const isMilestone = row?.measure_type === "milestone"
  const targetDepartment = row?.department || department

  useEffect(() => {
    if (!row) return
    if (row.latest_actual) {
      setActualValue(row.latest_actual.actual_value != null ? String(row.latest_actual.actual_value) : "")
      setMilestonesCompleted(
        row.latest_actual.milestones_completed != null ? String(row.latest_actual.milestones_completed) : ""
      )
      setMilestonesTotal(row.latest_actual.milestones_total != null ? String(row.latest_actual.milestones_total) : "3")
      setNote(row.latest_actual.note || "")
    } else if (row.source === "auto") {
      setActualValue(row.effective_actual != null ? String(row.effective_actual) : "")
      setMilestonesCompleted(
        row.effective_milestones_completed != null ? String(row.effective_milestones_completed) : ""
      )
      setMilestonesTotal(row.effective_milestones_total != null ? String(row.effective_milestones_total) : "3")
      setNote("")
    } else {
      setActualValue("")
      setMilestonesCompleted("")
      setMilestonesTotal("3")
      setNote("")
    }
  }, [row])

  async function handleResetToAuto() {
    if (!row) return
    setIsResetting(true)
    try {
      const res = await apiFetch(
        `/api/corporate-scorecard/actuals?kpi_id=${row.kpi_id}&department=${encodeURIComponent(targetDepartment)}`,
        {
          method: "DELETE",
        }
      )
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to reset to auto-derivation")
      toast.success("Manual override removed. Scorecard resynced to live tasks.")
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset override")
    } finally {
      setIsResetting(false)
    }
  }

  async function handleSave() {
    if (!row) return
    if (isMilestone && !milestonesCompleted.trim()) {
      toast.error("Enter how many milestones are complete")
      return
    }
    if (!isMilestone && !actualValue.trim()) {
      toast.error("Enter the actual value")
      return
    }

    setIsSaving(true)
    try {
      const res = await apiFetch("/api/corporate-scorecard/actuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kpi_id: row.kpi_id,
          department: targetDepartment,
          actual_value: isMilestone ? null : Number(actualValue),
          milestones_completed: isMilestone ? Number(milestonesCompleted) : null,
          milestones_total: isMilestone ? Number(milestonesTotal || 3) : null,
          note: note.trim() || null,
          is_override: true,
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to record")
      toast.success("Progress saved as manual override")
      setActualValue("")
      setMilestonesCompleted("")
      setNote("")
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Record / Override Actual</DialogTitle>
          <DialogDescription>
            {row?.measure} · <span className="text-foreground font-medium">{targetDepartment}</span>
          </DialogDescription>
        </DialogHeader>

        {row?.source === "auto" && (
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-700 dark:text-blue-300">
            <div className="flex items-center gap-1.5 font-semibold">
              <Zap className="h-3.5 w-3.5" />
              <span>Live Task Derivation Active</span>
            </div>
            <p className="mt-1">
              Detected <strong>{row.task_stats?.completed || 0} completed</strong> of {row.task_stats?.total || 0} tasks
              for this KPI in {targetDepartment}.
            </p>
            <p className="text-muted-foreground mt-0.5 text-[11px]">
              Saving a value below will set a managerial override.
            </p>
          </div>
        )}

        {row?.source === "manual" && row.is_override && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
            <div className="flex items-center justify-between font-semibold">
              <span>✏️ Manual Managerial Override Active</span>
            </div>
            <p className="mt-1">
              A manual actual of <strong>{row.effective_actual ?? row.latest_actual?.actual_value}</strong> is currently
              in effect
              {row.latest_actual?.recorded_at ? ` (saved ${formatWATDate(row.latest_actual.recorded_at)})` : ""}.
              {row.task_stats && row.task_stats.total > 0 && (
                <> Live system tracks {row.task_stats.completed} completed tasks.</>
              )}
            </p>
          </div>
        )}

        {isMilestone ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Milestones completed *</Label>
              <Input
                type="number"
                min={0}
                value={milestonesCompleted}
                onChange={(e) => setMilestonesCompleted(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Of how many total</Label>
              <Input
                type="number"
                min={1}
                value={milestonesTotal}
                onChange={(e) => setMilestonesTotal(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Actual value *</Label>
            <Input
              type="number"
              value={actualValue}
              onChange={(e) => setActualValue(e.target.value)}
              placeholder="e.g. 3"
            />
            {row?.target_value != null && (
              <p className="text-muted-foreground text-[11px]">
                Target is {row.target_value} {row.target_unit || ""}.
              </p>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Note / Rationale (optional)</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Context or reason for this adjustment..."
            className="min-h-[60px] text-xs"
          />
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {row?.is_override && row?.latest_actual ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleResetToAuto()}
              disabled={isSaving || isResetting}
              className="border-blue-500/20 text-blue-600 hover:bg-blue-50 sm:mr-auto dark:border-blue-500/40 dark:text-blue-400 dark:hover:bg-blue-950"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              {isResetting ? "Resetting..." : "Reset to Live Auto"}
            </Button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving || isResetting}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={isSaving || isResetting}>
              {isSaving ? "Saving..." : "Save Override"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
