"use client"

import { useMemo } from "react"
import { ClipboardList, Star } from "lucide-react"
import { DataTable } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { TaskStatusBadge, statusLabel } from "@/components/tasks/TaskStatusControl"
import { TASK_STATUSES } from "@/lib/tasks/constants"
import { formatFullName } from "@/lib/utils"
import { formatWATDate, toLocalISODate } from "@/lib/utils/date"
import type { WorkTask } from "@/lib/projects/work-tasks"

const UNASSIGNED = "__unassigned__"
const WHOLE_PORTFOLIO_KEY = "__portfolio__"
const WHOLE_PORTFOLIO = "Whole portfolio"

function projectLabel(task: WorkTask) {
  return task.project_id ? task.project?.project_name || "Project" : WHOLE_PORTFOLIO
}

function assigneeName(task: WorkTask) {
  const user = task.assigned_user
  return user ? formatFullName(user.first_name, user.last_name) : ""
}

/**
 * The Tasks tab on a project or portfolio page: every task linked to it, with
 * who has it, where it stands, and when it is due. Read-only — tasks are
 * created and managed from the plan board (projects) or Task Management.
 * `plans` adds a Plan column for a project's tasks.
 */
export function WorkTasksTable({
  tasks,
  isLoading,
  error,
  onRetry,
  plans,
  showProject = false,
  emptyDescription,
}: {
  tasks: WorkTask[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
  plans?: ReadonlyArray<{ id: string; name: string }>
  /** Portfolio pages: add a Project column ("Whole portfolio" for portfolio-level tasks) and filter. */
  showProject?: boolean
  emptyDescription: string
}) {
  const today = toLocalISODate()
  const rows = useMemo(() => tasks.filter((task) => !task.is_archived), [tasks])
  const planNames = useMemo(() => new Map((plans ?? []).map((plan) => [plan.id, plan.name])), [plans])

  const columns = useMemo<DataTableColumn<WorkTask>[]>(
    () => [
      {
        key: "title",
        label: "Task",
        sortable: true,
        accessor: (r) => r.title,
        render: (r) => (
          <div className="space-y-0.5">
            <p className="text-foreground font-medium">{r.title}</p>
            {r.work_item_number && <p className="text-muted-foreground font-mono text-xs">{r.work_item_number}</p>}
          </div>
        ),
      },
      {
        key: "assignee",
        label: "Assignee",
        sortable: true,
        accessor: (r) => assigneeName(r),
        render: (r) => assigneeName(r) || <span className="text-muted-foreground text-xs">Unassigned</span>,
      },
      ...(showProject
        ? [
            {
              key: "project",
              label: "Project",
              sortable: true,
              accessor: (r: WorkTask) => projectLabel(r),
              render: (r: WorkTask) =>
                r.project_id ? (
                  projectLabel(r)
                ) : (
                  <span className="text-muted-foreground text-xs">{WHOLE_PORTFOLIO}</span>
                ),
            },
          ]
        : []),
      ...(plans
        ? [
            {
              key: "plan",
              label: "Plan",
              sortable: true,
              accessor: (r: WorkTask) => (r.plan_id ? (planNames.get(r.plan_id) ?? "") : ""),
              hideOnMobile: true,
            },
          ]
        : []),
      {
        key: "status",
        label: "Status",
        sortable: true,
        accessor: (r) => r.status,
        render: (r) => <TaskStatusBadge status={r.status} />,
      },
      {
        key: "due_date",
        label: "Due",
        sortable: true,
        accessor: (r) => r.due_date ?? "",
        render: (r) => {
          if (!r.due_date) return <span className="text-muted-foreground text-xs">—</span>
          const overdue = r.due_date.slice(0, 10) < today && !["completed", "cancelled"].includes(r.status)
          return (
            <span className={overdue ? "text-destructive text-xs font-medium" : "text-xs"}>
              {formatWATDate(r.due_date)}
            </span>
          )
        },
      },
      {
        key: "rating",
        label: "Rating",
        sortable: true,
        accessor: (r) => r.rating ?? -1,
        render: (r) =>
          r.rating ? (
            <span className="inline-flex items-center gap-1 text-xs">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {r.rating} / 5
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
        hideOnMobile: true,
      },
    ],
    [plans, planNames, showProject, today]
  )

  const filters = useMemo<DataTableFilter<WorkTask>[]>(() => {
    const people = new Map<string, string>()
    for (const task of rows) people.set(task.assigned_to || UNASSIGNED, assigneeName(task) || "Unassigned")
    const projects = new Map<string, string>()
    for (const task of rows) projects.set(task.project_id || WHOLE_PORTFOLIO_KEY, projectLabel(task))
    return [
      ...(showProject
        ? [
            {
              key: "project",
              label: "Project",
              options: Array.from(projects, ([value, label]) => ({ value, label })).sort((a, b) =>
                a.label.localeCompare(b.label)
              ),
              mode: "custom" as const,
              filterFn: (row: WorkTask, selected: string[]) => selected.includes(row.project_id || WHOLE_PORTFOLIO_KEY),
            },
          ]
        : []),
      {
        key: "status",
        label: "Status",
        options: TASK_STATUSES.filter((status) => rows.some((task) => task.status === status)).map((status) => ({
          value: status,
          label: statusLabel(status),
        })),
      },
      {
        key: "assignee",
        label: "Assignee",
        options: Array.from(people, ([value, label]) => ({ value, label })).sort((a, b) =>
          a.label.localeCompare(b.label)
        ),
        mode: "custom",
        filterFn: (row, selected) => selected.includes(row.assigned_to || UNASSIGNED),
      },
    ]
  }, [rows, showProject])

  return (
    <DataTable<WorkTask>
      data={rows}
      columns={columns}
      filters={filters}
      getRowId={(r) => r.id}
      searchPlaceholder="Search task or assignee..."
      searchFn={(row, query) => {
        const q = query.toLowerCase()
        return [row.title, row.work_item_number, assigneeName(row)].some((v) => (v || "").toLowerCase().includes(q))
      }}
      isLoading={isLoading}
      error={error instanceof Error ? error.message : null}
      onRetry={onRetry}
      viewToggle
      contactsView
      defaultViewMode={{ mobile: "contacts", desktop: "list" }}
      mobileRow={{
        title: (r) => r.title,
        subtitle: (r) =>
          [assigneeName(r) || "Unassigned", r.due_date ? `due ${formatWATDate(r.due_date)}` : null]
            .filter(Boolean)
            .join(" · "),
        trailing: (r) => <TaskStatusBadge status={r.status} />,
      }}
      cardRenderer={(r) => (
        <div className="bg-card space-y-2 rounded-xl border p-4 text-xs">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold">{r.title}</p>
            <TaskStatusBadge status={r.status} />
          </div>
          <p className="text-muted-foreground">
            {assigneeName(r) || "Unassigned"}
            {r.due_date ? ` · due ${formatWATDate(r.due_date)}` : ""}
          </p>
        </div>
      )}
      emptyTitle="No Tasks Yet"
      emptyDescription={emptyDescription}
      emptyIcon={ClipboardList}
    />
  )
}
