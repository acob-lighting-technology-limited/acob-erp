"use client"

import { useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Building2, ClipboardCheck, Clock, Scale } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { TaskStatusControl } from "@/components/tasks/TaskStatusControl"
import { QUERY_KEYS } from "@/lib/query-keys"
import { cn } from "@/lib/utils"
import { formatWATDate, formatWATRelative } from "@/lib/utils/date"
import { SELF_RATING_BLOCKED_REASON } from "@/lib/tasks/rating-authority"
import { TASK_WEIGHT_DEFAULT, getTaskWeightBadgeClass } from "@/lib/tasks/scoring"
import type { Task } from "@/types/task"
import { useMdTaskReviews } from "./use-md-desk"

const DAY_MS = 86_400_000

function assigneeName(t: Task): string {
  const u = t.assigned_to_user
  return u ? [u.first_name, u.last_name].filter(Boolean).join(" ") || "Unknown" : "Unknown"
}

function submittedAt(t: Task): string {
  return t.updated_at || t.created_at
}

/**
 * MD's Desk → Task Reviews. Tasks a lead, admin or project manager assigned to
 * themselves and submitted: nobody rates their own work, so they wait here for
 * the MD (or another administrator). Rating uses the same TaskStatusControl as
 * Admin › Tasks, so the rules and the rating scale are identical.
 */
export function MdDeskTaskReviews({ basePath }: { basePath: string }) {
  const queryClient = useQueryClient()
  const { data, isLoading, error, refetch } = useMdTaskReviews()
  const tasks = useMemo(() => data?.tasks ?? [], [data])
  const viewer = data?.viewer

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.mdDeskTaskReviews() }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.mdDeskOverview() }),
    ])
  }

  const now = Date.now()
  const waitingLong = tasks.filter((t) => now - new Date(submittedAt(t)).getTime() > 3 * DAY_MS).length
  const departments = Array.from(new Set(tasks.map((t) => t.department).filter((v): v is string => Boolean(v))))
  const totalWeight = tasks.reduce((sum, t) => sum + (t.weight || TASK_WEIGHT_DEFAULT), 0)

  const control = (t: Task, size: "default" | "sm" = "sm") => (
    <TaskStatusControl
      task={t}
      canReview={viewer?.canReview === true}
      ratingBlockedReason={viewer && t.assigned_to === viewer.id ? SELF_RATING_BLOCKED_REASON : null}
      onChanged={refresh}
      size={size}
    />
  )

  const weightBadge = (t: Task) => (
    <Badge variant="outline" className={cn("font-mono text-[11px] font-medium", getTaskWeightBadgeClass(t.weight))}>
      W{t.weight || TASK_WEIGHT_DEFAULT}
    </Badge>
  )

  const columns: DataTableColumn<Task>[] = [
    {
      key: "title",
      label: "Task",
      sortable: true,
      accessor: (t) => t.title,
      resizable: true,
      initialWidth: 280,
      render: (t) => (
        <div className="min-w-0 space-y-0.5">
          <p className="truncate font-medium">{t.title}</p>
          <p className="text-muted-foreground truncate text-xs">
            {[t.work_item_number, t.project_name].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "assignee",
      label: "Submitted by",
      sortable: true,
      accessor: (t) => assigneeName(t),
    },
    { key: "department", label: "Department", sortable: true, accessor: (t) => t.department ?? "—" },
    {
      key: "kpi",
      label: "Corporate KPI",
      accessor: (t) => t.kpi_measure ?? "—",
      render: (t) => <span className="line-clamp-2 text-sm">{t.kpi_measure || "—"}</span>,
      hideOnMobile: true,
    },
    {
      key: "weight",
      label: "Weight",
      sortable: true,
      accessor: (t) => String(t.weight || TASK_WEIGHT_DEFAULT),
      render: weightBadge,
    },
    {
      key: "submitted",
      label: "Waiting since",
      sortable: true,
      accessor: (t) => submittedAt(t),
      render: (t) => (
        <span className="text-sm" title={formatWATDate(submittedAt(t))}>
          {formatWATRelative(submittedAt(t))}
        </span>
      ),
    },
    { key: "review", label: "Review", render: (t) => control(t) },
  ]

  const filters: DataTableFilter<Task>[] = [
    { key: "department", label: "Department", options: departments.map((d) => ({ value: d, label: d })) },
    {
      key: "weight",
      label: "Weight",
      options: [1, 2, 3, 4, 5].map((w) => ({ value: String(w), label: `Weight ${w}` })),
    },
  ]

  return (
    <DataTablePage
      title="Task Reviews"
      description="Tasks that leads and admins assigned to themselves. Nobody rates their own work, so they wait for the MD."
      icon={ClipboardCheck}
      backLink={{ href: `${basePath}/overview`, label: "Back to MD's Desk" }}
      stats={
        <StatGrid>
          <StatCard
            variant="compact"
            title="Awaiting rating"
            value={tasks.length}
            icon={ClipboardCheck}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            variant="compact"
            title="Waiting 3+ days"
            value={waitingLong}
            icon={Clock}
            iconBgColor="bg-red-500/10"
            iconColor="text-red-500"
          />
          <StatCard
            variant="compact"
            title="Weight points"
            value={totalWeight}
            icon={Scale}
            iconBgColor="bg-violet-500/10"
            iconColor="text-violet-500"
          />
          <StatCard
            variant="compact"
            title="Departments"
            value={departments.length}
            icon={Building2}
            iconBgColor="bg-emerald-500/10"
            iconColor="text-emerald-500"
          />
        </StatGrid>
      }
    >
      <DataTable<Task>
        data={tasks}
        columns={columns}
        getRowId={(t) => t.id}
        searchPlaceholder="Search tasks, people, KPIs…"
        searchFn={(t, q) =>
          [t.title, t.work_item_number, assigneeName(t), t.department, t.kpi_measure, t.project_name]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))
        }
        filters={filters}
        isLoading={isLoading}
        error={error instanceof Error ? error.message : null}
        onRetry={() => refetch()}
        pagination={{ pageSize: 25 }}
        viewToggle
        defaultViewMode={{ mobile: "card", desktop: "list" }}
        cardRenderer={(t) => (
          <div className="bg-card flex h-full flex-col gap-3 rounded-xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{t.title}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {[t.work_item_number, t.project_name].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              {weightBadge(t)}
            </div>
            <div className="grid gap-1 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Submitted by</span>
                <span className="truncate">{assigneeName(t)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Department</span>
                <span className="truncate">{t.department || "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Waiting</span>
                <span>{formatWATRelative(submittedAt(t))}</span>
              </div>
            </div>
            {t.kpi_measure && <p className="text-muted-foreground line-clamp-2 text-xs">KPI: {t.kpi_measure}</p>}
            <div className="mt-auto">{control(t, "default")}</div>
          </div>
        )}
      />
    </DataTablePage>
  )
}
