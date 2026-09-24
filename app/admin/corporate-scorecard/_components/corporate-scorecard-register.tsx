"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { toast } from "sonner"
import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  Clock,
  Edit,
  Layers,
  ListTodo,
  Plus,
  Target,
  Trash2,
  TrendingUp,
  UserCog,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter, DataTableTab } from "@/components/ui/data-table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { apiFetch } from "@/lib/api-client"
import { formatWATDate } from "@/lib/utils/date"
import { CreateKpiDialog, EditKpiDialog, ArchiveKpiDialog, PERSPECTIVES } from "./kpi-dialogs"

type Assignment = {
  id: string
  department: string
  role: "core" | "support"
  target_value?: number | null
  target_unit?: string | null
  department_target?: string | null
  proposed_action?: string | null
  latest_actual?: {
    actual_value: number | null
    milestones_completed: number | null
    milestones_total: number | null
    note: string | null
    recorded_at: string
  } | null
  raw_pct?: number | null
  capped_pct?: number | null
  status?: "green" | "amber" | "red" | null
}

type RegisterRow = {
  id: string
  source_sn: number
  perspective: string
  strategic_priority: string
  strategic_objective: string
  measure: string
  target_text: string
  measure_type: string
  direction: string
  core_departments: string[]
  support_departments: string[]
  assignments: Assignment[]
  overall_attainment?: number | null
  overall_status?: "green" | "amber" | "red" | null
  pacing?: {
    status: "ahead" | "on_pace" | "behind" | "no_data"
    elapsedPct: number
    label: string
  } | null
  task_stats?: {
    total: number
    completed: number
    in_progress: number
  } | null
}

export interface CorporateScorecardRegisterProps {
  tabs?: DataTableTab[]
  activeTab?: string
  onTabChange?: (tab: string) => void
}

/**
 * The master register: what the 2026 plan says, and who owns it.
 * "How we're doing against it" lives on each department's own cascade page —
 * this view is the plan, with administrative CRUD to add, edit, and archive KPIs.
 */
export function CorporateScorecardRegister({ tabs, activeTab, onTabChange }: CorporateScorecardRegisterProps = {}) {
  const queryClient = useQueryClient()
  const queryKey = ["corporate-scorecard-register"]
  const [managingRow, setManagingRow] = useState<RegisterRow | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<RegisterRow | null>(null)
  const [archivingRow, setArchivingRow] = useState<RegisterRow | null>(null)

  const { data, isLoading, error, refetch } = useQuery<{ data: RegisterRow[] }>({
    queryKey,
    queryFn: async () => {
      const res = await apiFetch("/api/corporate-scorecard/register", { cache: "no-store" })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to load the corporate scorecard")
      return payload
    },
  })

  const rows = useMemo(() => data?.data ?? [], [data])

  const departmentOptions = useMemo(() => {
    const set = new Set<string>()
    for (const row of rows) {
      for (const d of row.core_departments) set.add(d)
      for (const d of row.support_departments) set.add(d)
    }
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value, label: value }))
  }, [rows])

  const pillarOptions = useMemo(() => {
    const set = new Set<string>()
    for (const row of rows) {
      if (row.strategic_priority) set.add(row.strategic_priority)
    }
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value, label: value }))
  }, [rows])

  const stats = useMemo(() => {
    const byPerspective = new Map<string, number>()
    for (const row of rows) byPerspective.set(row.perspective, (byPerspective.get(row.perspective) || 0) + 1)
    return { total: rows.length, byPerspective }
  }, [rows])

  const columns = useMemo<DataTableColumn<RegisterRow>[]>(
    () => [
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
        initialWidth: 320,
        accessor: (r) => r.measure,
        render: (r) => (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs leading-snug font-medium">{r.measure}</span>
            <span className="text-muted-foreground text-[11px]">
              {r.perspective} · {r.strategic_objective}
            </span>
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
        key: "target_text",
        label: "2026 Target",
        accessor: (r) => r.target_text,
        render: (r) => <span className="text-xs">{r.target_text}</span>,
        hideOnMobile: true,
      },
      {
        key: "core_departments",
        label: "Core Owner(s)",
        accessor: (r) => r.core_departments.join(", "),
        render: (r) => (
          <div className="flex flex-wrap gap-1">
            {r.core_departments.map((d) => (
              <Badge key={d} className="border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-600">
                {d}
              </Badge>
            ))}
          </div>
        ),
      },
    ],
    []
  )

  const filters = useMemo<DataTableFilter<RegisterRow>[]>(
    () => [
      {
        key: "perspective",
        label: "Perspective",
        options: PERSPECTIVES.map((value) => ({ value, label: value })),
      },
      {
        key: "strategic_priority",
        label: "Strategic Pillar",
        options: pillarOptions,
      },
      {
        key: "department",
        label: "Department",
        options: departmentOptions,
        mode: "custom",
        filterFn: (row, selected) =>
          selected.some((dept) => row.core_departments.includes(dept) || row.support_departments.includes(dept)),
      },
    ],
    [departmentOptions, pillarOptions]
  )

  return (
    <DataTablePage
      title="Corporate Scorecard"
      description="The 2026 strategic plan's master corporate KPIs and which departments own them. Use Add Corporate KPI to register new strategic measures."
      icon={Target}
      backLink={{ href: "/admin", label: "Back to Admin" }}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      actions={
        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Corporate KPI
        </Button>
      }
      stats={
        <StatGrid>
          <StatCard
            variant="compact"
            title="Total KPIs"
            value={stats.total}
            icon={ClipboardList}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          {PERSPECTIVES.map((p) => (
            <StatCard
              key={p}
              variant="compact"
              title={p}
              value={stats.byPerspective.get(p) || 0}
              icon={p === "Organizational Capacity" ? Users : Target}
              iconBgColor="bg-violet-500/10"
              iconColor="text-violet-500"
            />
          ))}
        </StatGrid>
      }
    >
      <DataTable<RegisterRow>
        data={rows}
        columns={columns}
        filters={filters}
        getRowId={(r) => r.id}
        searchPlaceholder="Search KPI, objective, or perspective..."
        searchFn={(row, query) =>
          `${row.measure} ${row.strategic_objective} ${row.strategic_priority} ${row.perspective}`
            .toLowerCase()
            .includes(query.toLowerCase())
        }
        isLoading={isLoading}
        error={error instanceof Error ? error.message : null}
        onRetry={refetch}
        emptyTitle="No KPIs Found"
        emptyDescription="The corporate scorecard hasn't been imported yet."
        emptyIcon={Target}
        rowActions={[
          { label: "Edit KPI", icon: Edit, onClick: (r) => setEditingRow(r) },
          { label: "Manage Departments", icon: UserCog, onClick: (r) => setManagingRow(r) },
          { label: "Archive KPI", icon: Trash2, onClick: (r) => setArchivingRow(r), variant: "destructive" },
        ]}
        expandable={{
          render: (r) => {
            const pacing = r.pacing
            const taskStats = r.task_stats || { total: 0, completed: 0, in_progress: 0 }

            return (
              <div className="bg-card/60 space-y-4 rounded-lg border p-4 text-xs">
                {/* Top Summary Banner: Pacing & Overall Attainment */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                      2026 Timeline Pacing:
                    </span>
                    {pacing?.status === "ahead" && (
                      <Badge className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-[11px] text-emerald-600">
                        <TrendingUp className="h-3 w-3" /> Ahead of schedule ({pacing.elapsedPct}% of year)
                      </Badge>
                    )}
                    {pacing?.status === "on_pace" && (
                      <Badge className="gap-1 border-blue-500/30 bg-blue-500/10 text-[11px] text-blue-600">
                        <Clock className="h-3 w-3" /> On pace ({pacing.elapsedPct}% of year)
                      </Badge>
                    )}
                    {pacing?.status === "behind" && (
                      <Badge className="gap-1 border-red-500/30 bg-red-500/10 text-[11px] text-red-600">
                        <AlertTriangle className="h-3 w-3" /> Behind schedule ({pacing.elapsedPct}% of year)
                      </Badge>
                    )}
                    {(!pacing || pacing.status === "no_data") && (
                      <Badge variant="outline" className="text-muted-foreground text-[11px]">
                        No actuals logged yet ({pacing?.elapsedPct ?? 0}% of year elapsed)
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-[11px] font-medium">Overall CORE Attainment:</span>
                    {r.overall_attainment != null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-24">
                          <Progress value={r.overall_attainment} />
                        </div>
                        <span className="text-foreground text-xs font-semibold">{r.overall_attainment}%</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs italic">Awaiting updates</span>
                    )}
                  </div>
                </div>

                {/* Department Ownership & Execution Matrix */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                      Department Responsibilities & Quotas (RACI)
                    </p>
                    <span className="text-muted-foreground text-[11px]">
                      Only CORE owners drive the scorecard score
                    </span>
                  </div>

                  <div className="bg-background/50 overflow-x-auto rounded-md border">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 text-muted-foreground text-[11px] font-medium">
                        <tr>
                          <th className="px-3 py-2">Department</th>
                          <th className="px-3 py-2">Role</th>
                          <th className="px-3 py-2">Department Quota / Deliverable</th>
                          <th className="px-3 py-2">Latest Progress</th>
                          <th className="px-3 py-2">Attainment</th>
                          <th className="px-3 py-2">Proposed Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {r.assignments.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-muted-foreground px-3 py-4 text-center">
                              No departments assigned yet. Use &ldquo;Manage Departments&rdquo; to assign ownership.
                            </td>
                          </tr>
                        ) : (
                          r.assignments.map((a) => {
                            const isCore = a.role === "core"
                            const quotaDisplay =
                              a.target_value != null
                                ? `${a.target_value} ${a.target_unit || ""}`.trim()
                                : a.department_target || r.target_text

                            return (
                              <tr key={a.id} className={isCore ? "bg-background" : "bg-muted/10 opacity-80"}>
                                <td className="px-3 py-2 font-medium">{a.department}</td>
                                <td className="px-3 py-2">
                                  {isCore ? (
                                    <Badge className="border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-600">
                                      CORE
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px]">
                                      SUPPORT
                                    </Badge>
                                  )}
                                </td>
                                <td className="text-muted-foreground max-w-xs px-3 py-2">{quotaDisplay}</td>
                                <td className="px-3 py-2">
                                  {a.latest_actual ? (
                                    <div className="flex flex-col">
                                      <span className="text-foreground font-medium">
                                        {a.latest_actual.actual_value != null
                                          ? `${a.latest_actual.actual_value}`
                                          : a.latest_actual.milestones_completed != null
                                            ? `${a.latest_actual.milestones_completed}/${a.latest_actual.milestones_total} milestones`
                                            : "Recorded"}
                                      </span>
                                      {a.latest_actual.recorded_at && (
                                        <span className="text-muted-foreground text-[10px]">
                                          {formatWATDate(a.latest_actual.recorded_at)}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-[11px] italic">No data</span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {a.capped_pct != null ? (
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-16">
                                        <Progress value={a.capped_pct} />
                                      </div>
                                      <span className="text-[11px] font-medium">{a.capped_pct}%</span>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-[11px]">-</span>
                                  )}
                                </td>
                                <td
                                  className="text-muted-foreground max-w-sm truncate px-3 py-2"
                                  title={a.proposed_action || ""}
                                >
                                  {a.proposed_action || "Not yet defined"}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Operational Evidence & Tasks Summary */}
                <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-[11px]">
                  <div className="flex items-center gap-2">
                    <ListTodo className="text-primary h-4 w-4" />
                    <span className="text-foreground font-semibold">Operational Evidence:</span>
                    <span>
                      {taskStats.total > 0 ? (
                        <>
                          <strong className="text-foreground">{taskStats.total}</strong> active task
                          {taskStats.total === 1 ? "" : "s"} tagged to this KPI ({taskStats.completed} completed,{" "}
                          {taskStats.in_progress} in progress).
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          No tasks currently tagged to this corporate KPI in PMS/Tasks.
                        </span>
                      )}
                    </span>
                  </div>
                  <Link
                    href="/tasks"
                    className="text-primary inline-flex items-center gap-1 font-medium hover:underline"
                  >
                    View Tasks
                  </Link>
                </div>
              </div>
            )
          },
        }}
        viewToggle
        contactsView
        stickyToolbar
        defaultViewMode={{ mobile: "contacts", desktop: "list" }}
        mobileRow={{
          title: (r) => r.measure,
          subtitle: (r) => `${r.perspective} · ${r.strategic_objective}`,
          trailing: (r) => (
            <Badge variant="outline" className="text-[10px]">
              {r.core_departments.length} depts
            </Badge>
          ),
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
              <Badge variant="outline">{r.core_departments.length} depts</Badge>
            </div>
            <p className="text-muted-foreground line-clamp-2 text-xs">{r.strategic_objective}</p>
            <div className="flex items-center justify-between border-t pt-2 text-[10px]">
              <span>Target: {r.target_text}</span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px]"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingRow(r)
                  }}
                >
                  <Edit className="mr-1 h-3 w-3" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px]"
                  onClick={(e) => {
                    e.stopPropagation()
                    setManagingRow(r)
                  }}
                >
                  <UserCog className="mr-1 h-3 w-3" /> Manage
                </Button>
              </div>
            </div>
          </div>
        )}
        urlSync
      />

      <ManageDepartmentsDialog
        row={rows.find((r) => r.id === managingRow?.id) ?? managingRow}
        onOpenChange={(open) => !open && setManagingRow(null)}
        onChanged={() => void queryClient.invalidateQueries({ queryKey })}
      />

      <CreateKpiDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onChanged={() => void queryClient.invalidateQueries({ queryKey })}
      />

      <EditKpiDialog
        row={rows.find((r) => r.id === editingRow?.id) ?? editingRow}
        onOpenChange={(open) => !open && setEditingRow(null)}
        onChanged={() => void queryClient.invalidateQueries({ queryKey })}
      />

      <ArchiveKpiDialog
        row={rows.find((r) => r.id === archivingRow?.id) ?? archivingRow}
        onOpenChange={(open) => !open && setArchivingRow(null)}
        onChanged={() => void queryClient.invalidateQueries({ queryKey })}
      />
    </DataTablePage>
  )
}

/**
 * Add or remove a department from a KPI's RACI grid. This is the affordance
 * for the four departments the source workbook left unmapped (Logistics,
 * Monitoring & Evaluation, Executive Management, SIWES) — the schema always
 * allowed any free-text department, this is the UI to actually use that.
 */
function ManageDepartmentsDialog({
  row,
  onOpenChange,
  onChanged,
}: {
  row: RegisterRow | null
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}) {
  const open = row !== null
  const [department, setDepartment] = useState("")
  const [role, setRole] = useState<"core" | "support">("core")
  const [isSaving, setIsSaving] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const { data: deptData } = useQuery<{ data: Array<{ name: string }> }>({
    queryKey: ["departments-all"],
    queryFn: async () => {
      const res = await apiFetch("/api/departments", { cache: "no-store" })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to load departments")
      return payload
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  const assignedNames = new Set((row?.assignments ?? []).map((a) => a.department))
  const availableDepartments = (deptData?.data ?? [])
    .map((d) => d.name)
    .filter((name) => !assignedNames.has(name))
    .sort((a, b) => a.localeCompare(b))

  function reset() {
    setDepartment("")
    setRole("core")
  }

  async function handleAdd() {
    if (!row || !department) return
    setIsSaving(true)
    try {
      const res = await apiFetch("/api/corporate-scorecard/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kpi_id: row.id, department, role }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to add department")
      toast.success(`${department} added as ${role.toUpperCase()}`)
      reset()
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add department")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemove(assignment: Assignment) {
    setRemovingId(assignment.id)
    try {
      const res = await apiFetch(`/api/corporate-scorecard/assignments/${assignment.id}`, { method: "DELETE" })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to remove department")
      toast.success(`${assignment.department} removed`)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove department")
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Manage Departments</DialogTitle>
          <DialogDescription>{row?.measure}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {(row?.assignments ?? []).length === 0 ? (
            <p className="text-muted-foreground text-xs">No department assigned yet.</p>
          ) : (
            (row?.assignments ?? [])
              .slice()
              .sort((a, b) => a.department.localeCompare(b.department))
              .map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{a.department}</span>
                    {a.role === "core" ? (
                      <Badge className="border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-600">
                        CORE
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        SUPPORT
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive h-7 px-2"
                    disabled={removingId === a.id}
                    onClick={() => void handleRemove(a)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
          )}
        </div>

        <div className="flex items-end gap-2 border-t pt-3">
          <div className="flex-1 space-y-1.5">
            <span className="text-xs font-medium">Add department</span>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select a department" />
              </SelectTrigger>
              <SelectContent>
                {availableDepartments.length === 0 ? (
                  <div className="text-muted-foreground px-2 py-1.5 text-xs">All departments assigned</div>
                ) : (
                  availableDepartments.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="w-28 space-y-1.5">
            <span className="text-xs font-medium">Role</span>
            <Select value={role} onValueChange={(v) => setRole(v as "core" | "support")}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="core">CORE</SelectItem>
                <SelectItem value="support">SUPPORT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" className="h-9" disabled={!department || isSaving} onClick={() => void handleAdd()}>
            Add
          </Button>
        </div>

        <p className="text-muted-foreground text-[11px]">
          Only CORE departments are scored on this KPI. Set the department&apos;s own numeric target from its cascade
          page after adding it.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
