"use client"

import { useMemo, useState } from "react"
import { isTaskOverdue as isTaskPastDeadline } from "@/lib/tasks/overdue"
import { toLocalISODate } from "@/lib/utils/date"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { logger } from "@/lib/logger"
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  MessageSquare,
  Send,
  AlertTriangle,
  CalendarDays,
  Target,
  Scale,
} from "lucide-react"

import { UserTaskDetailsDialog } from "@/components/tasks/UserTaskDetailsDialog"
import { loadUserTasks } from "@/components/tasks/user-tasks-data"
import { Button } from "@/components/ui/button"
import { StaffAvatar } from "@/components/ui/staff-avatar"
import { useStaffAvatars } from "@/hooks/use-staff-avatars"
import { TaskStatusControl } from "@/components/tasks/TaskStatusControl"
import { TASK_STATUS_CONFIG, type TaskStatus } from "@/lib/tasks/constants"
import { TASK_WEIGHT_DEFAULT, getTaskWeightBadgeClass } from "@/lib/tasks/scoring"
import type { Task, TaskUserProfile } from "@/types/task"
import { SELF_RATING_BLOCKED_REASON, isSelfRatingBlocked } from "@/lib/tasks/rating-authority"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { Badge } from "@/components/ui/badge"
import { cn, formatName, formatFullName } from "@/lib/utils"
import { formatWATDate } from "@/lib/utils/date"
import { apiFetch } from "@/lib/api-client"

export type { Task, TaskUserProfile } from "@/types/task"

const log = logger("tasks-management-tasks-content")

export interface TaskUpdate {
  id: string
  content?: string
  update_type: string
  created_at: string
  user?: {
    first_name: string
    last_name: string
  }
}

type TaskUpdateRow = Omit<TaskUpdate, "user"> & {
  user_id?: string | null
  user?: Array<{ first_name: string; last_name: string }> | { first_name: string; last_name: string } | null
}

interface TasksContentProps {
  initialTasks: Task[]
  userId: string
  userProfile: TaskUserProfile | null
}

/** Read-only status pill for the row list and cards, where the whole row is
 * already the tap target and an inline control inside it would fight for taps.
 * The editable `TaskStatusControl` lives in the table cell and the detail sheet. */
function TaskStatusPill({ status }: { status: string }) {
  const cfg = TASK_STATUS_CONFIG[status as TaskStatus] || TASK_STATUS_CONFIG.pending
  return (
    <Badge variant={cfg.badgeVariant} className={cn("text-[10px] whitespace-nowrap capitalize", cfg.color)}>
      {cfg.label}
    </Badge>
  )
}

/** Past its deadline and still actionable - a closed-out task is not overdue. */
function isTaskOverdue(task: Task): boolean {
  return isTaskPastDeadline(task, toLocalISODate())
}

export function TasksContent({ initialTasks, userId, userProfile }: TasksContentProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const staffAvatars = useStaffAvatars()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskUpdates, setTaskUpdates] = useState<TaskUpdate[]>([])
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isPostingComment, setIsPostingComment] = useState(false)
  const supabase = createClient()

  // Whether this user may approve, rate, reject or reassign a given task. The
  // control offers those decisions inline, so it needs to know per row.
  const canReviewTask = (task: Task) => {
    // An assignee viewing their own task acts strictly as an employee, not as a reviewer.
    if (
      task.assigned_to === userId ||
      (Array.isArray(task.assigned_users) &&
        task.assigned_users.some((u) => (typeof u === "string" ? u === userId : u.id === userId)))
    ) {
      return false
    }
    const role = String(userProfile?.role || "").toLowerCase()
    if (["admin", "super_admin", "developer"].includes(role)) return true
    if (!userProfile?.is_department_lead) return false
    const leadDepartments = Array.isArray(userProfile.lead_departments) ? userProfile.lead_departments : []
    const scope = [userProfile.department, ...leadDepartments].filter(Boolean) as string[]
    return Boolean(task.department && scope.includes(task.department))
  }

  const ratingBlockedReasonFor = (task: Task) =>
    isSelfRatingBlocked({ userId, assigneeIds: [task.assigned_to] }) ? SELF_RATING_BLOCKED_REASON : null

  const stats = useMemo(
    () => ({
      total: tasks.length,
      pending: tasks.filter((t) => t.status === "pending").length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      submitted: tasks.filter((t) => t.status === "submitted_for_review").length,
      completed: tasks.filter((t) => t.status === "completed").length,
      overdue: tasks.filter(isTaskOverdue).length,
    }),
    [tasks]
  )

  const loadTasks = async () => {
    try {
      const loaded = await loadUserTasks(supabase, userId, userProfile)
      setTasks(loaded)
      return loaded
    } catch (error: unknown) {
      log.error("Error loading tasks:", error)
      toast.error("Failed to load tasks")
      return null
    }
  }

  const loadTaskUpdates = async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .from("task_updates")
        .select("id, content, update_type, created_at, user_id")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })

      if (error) throw error

      const rows = (data as TaskUpdateRow[] | null) || []
      const userIds = Array.from(new Set(rows.map((entry) => entry.user_id).filter(Boolean))) as string[]
      const { data: profiles } =
        userIds.length > 0
          ? await supabase.from("profiles").select("id, first_name, last_name").in("id", userIds)
          : { data: [] }
      const profileMap = new Map(
        ((profiles as Array<{ id: string; first_name: string; last_name: string }> | null) || []).map((profile) => [
          profile.id,
          { first_name: profile.first_name, last_name: profile.last_name },
        ])
      )

      const normalizedUpdates = rows.map((entry) => ({
        id: entry.id,
        content: entry.content,
        update_type: entry.update_type,
        created_at: entry.created_at,
        user: entry.user_id ? profileMap.get(entry.user_id) : undefined,
      }))
      setTaskUpdates(normalizedUpdates)
    } catch (error) {
      log.error("Error loading task updates:", error)
      setTaskUpdates([])
    }
  }

  const openTaskDetails = async (task: Task) => {
    setSelectedTask(task)
    await loadTaskUpdates(task.id)
    setIsDetailsOpen(true)
  }

  // Status changes go through TaskStatusControl directly against the API now
  // — this used to be a second path (updateTaskStatus/handleUpdateStatus) that
  // existed only to serve the old "My Actions" tab, which no longer exists.

  const postComment = async (content: string) => {
    if (!selectedTask || !content.trim()) return
    setIsPostingComment(true)
    try {
      await supabase.from("task_updates").insert({
        task_id: selectedTask.id,
        user_id: userId,
        update_type: "comment",
        content: content.trim(),
      })
      toast.success("Comment added")
      await loadTaskUpdates(selectedTask.id)
      await loadTasks()
    } catch {
      toast.error("Failed to add comment")
    } finally {
      setIsPostingComment(false)
    }
  }

  const columns: DataTableColumn<Task>[] = [
    {
      key: "work_item_number",
      label: "Task ID",
      sortable: true,
      accessor: (t) => t.work_item_number,
      render: (t) => <span className="font-mono text-xs font-bold">{t.work_item_number || "---"}</span>,
      hideOnMobile: true,
    },
    {
      key: "title",
      label: "Task Title",
      sortable: true,
      resizable: true,
      initialWidth: 300,
      accessor: (t) => t.title,
      render: (t) => <span className="line-clamp-1 font-medium">{t.title}</span>,
    },
    {
      key: "goal",
      label: "Strategic Goal",
      sortable: true,
      accessor: (t) => t.goal_title || t.kpi_measure || "",
      render: (t) =>
        t.goal_title ? (
          <div className="flex flex-col">
            <span className="text-foreground line-clamp-1 text-xs font-medium">{t.goal_title}</span>
            {t.kpi_measure && <span className="text-muted-foreground line-clamp-1 text-[10px]">{t.kpi_measure}</span>}
          </div>
        ) : t.kpi_measure ? (
          <span className="text-foreground line-clamp-1 text-xs font-medium">{t.kpi_measure}</span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
      hideOnMobile: true,
    },
    {
      key: "weight",
      label: "Weight",
      sortable: true,
      accessor: (t) => t.weight ?? TASK_WEIGHT_DEFAULT,
      render: (t) => (
        <Badge variant="outline" className={cn("font-mono text-xs font-medium", getTaskWeightBadgeClass(t.weight))}>
          {t.weight ?? TASK_WEIGHT_DEFAULT}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (t) => t.status,
      // Changed straight from the row: opening a modal to move a task through
      // three states was the slowest part of the whole workflow.
      render: (t) => (
        <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <TaskStatusControl
            task={t}
            canReview={canReviewTask(t)}
            ratingBlockedReason={ratingBlockedReasonFor(t)}
            onChanged={() => void loadTasks()}
            size="sm"
          />
        </div>
      ),
    },
    {
      key: "due_date",
      label: "Due Date",
      sortable: true,
      accessor: (t) => t.due_date || "",
      render: (t) => {
        const isOverdue = isTaskOverdue(t)
        return (
          <div className="flex items-center gap-1.5 text-xs">
            <span className={isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"}>
              {t.due_date ? formatWATDate(t.due_date) : "No deadline"}
            </span>
            {isOverdue && <AlertTriangle className="text-destructive h-3 w-3" />}
          </div>
        )
      },
    },
    {
      key: "assigned_by",
      label: "Assigned By",
      accessor: (t) => t.assigned_by_user?.first_name || "",
      render: (t) => (
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          {t.assigned_by_user && (
            <StaffAvatar
              name={formatFullName(t.assigned_by_user.first_name, t.assigned_by_user.last_name)}
              src={t.assigned_by ? staffAvatars[t.assigned_by] : null}
              size="xs"
            />
          )}
          {t.assigned_by_user ? formatFullName(t.assigned_by_user.first_name, t.assigned_by_user.last_name) : "System"}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "comments",
      label: "Comments",
      sortable: true,
      accessor: (t) => t.comment_count || 0,
      // Comments live in Details → Activity now, not a second dialog reached
      // from a different button. This is one click through to that tab.
      render: (t) =>
        (t.comment_count || 0) > 0 ? (
          <button
            type="button"
            className="inline-flex"
            onClick={(event) => {
              event.stopPropagation()
              void openTaskDetails(t)
            }}
            title="View comments"
          >
            <Badge variant="outline" className="gap-1 text-xs">
              <MessageSquare className="h-3 w-3" />
              {t.comment_count}
            </Badge>
          </button>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        ),
      hideOnMobile: true,
    },
  ]

  const filters: DataTableFilter<Task>[] = [
    {
      key: "status",
      label: "Status",
      options: [
        { value: "pending", label: "Pending" },
        { value: "in_progress", label: "In Progress" },
        { value: "submitted_for_review", label: "Submitted for Review" },
        { value: "completed", label: "Completed" },
        { value: "unable_to_complete", label: "Unable to Complete" },
        { value: "reassigned", label: "Reassigned" },
        { value: "failed", label: "Failed" },
        { value: "cancelled", label: "Cancelled" },
      ],
    },
    {
      key: "weight",
      label: "Weight",
      options: [
        { value: "1", label: "Weight 1" },
        { value: "2", label: "Weight 2" },
        { value: "3", label: "Weight 3" },
        { value: "4", label: "Weight 4" },
        { value: "5", label: "Weight 5" },
      ],
      mode: "custom",
      filterFn: (row, vals) => {
        if (vals.length === 0) return true
        return vals.includes(String(row.weight ?? TASK_WEIGHT_DEFAULT))
      },
    },
  ]

  return (
    <DataTablePage
      title="My Tasks"
      description="Manage your operational tasks, track deadlines, and submit completed work for review."
      icon={ClipboardList}
      backLink={{ href: "/profile", label: "Back to Home" }}
      spacing="tight"
      stats={
        <StatGrid>
          <StatCard
            variant="compact"
            title="Total Tasks"
            value={stats.total}
            icon={ClipboardList}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            variant="compact"
            title="Pending"
            value={stats.pending}
            icon={Clock}
            iconBgColor="bg-amber-500/10"
            iconColor="text-amber-500"
          />
          <StatCard
            variant="compact"
            title="In Progress"
            value={stats.inProgress}
            icon={Clock}
            iconBgColor="bg-sky-500/10"
            iconColor="text-sky-500"
          />
          <StatCard
            variant="compact"
            title="Submitted"
            value={stats.submitted}
            icon={Send}
            iconBgColor="bg-purple-500/10"
            iconColor="text-purple-500"
          />
          <StatCard
            variant="compact"
            title="Completed"
            value={stats.completed}
            icon={CheckCircle2}
            iconBgColor="bg-emerald-500/10"
            iconColor="text-emerald-500"
          />
          {stats.overdue > 0 && (
            <StatCard
              variant="compact"
              title="Overdue"
              value={stats.overdue}
              icon={AlertTriangle}
              iconBgColor="bg-rose-500/10"
              iconColor="text-rose-500"
            />
          )}
        </StatGrid>
      }
    >
      <DataTable<Task>
        data={tasks}
        columns={columns}
        getRowId={(t) => t.id}
        searchPlaceholder="Search task title, description, ID..."
        // `q` is already trimmed and lowercased by DataTable.
        searchFn={(task, q) =>
          `${task.title} ${task.description || ""} ${task.work_item_number || ""} ${task.goal_title || ""}`
            .toLowerCase()
            .includes(q)
        }
        filters={filters}
        pagination={{ pageSize: 25 }}
        stickyToolbar
        viewToggle
        contactsView
        // Eight columns are worth a table where they fit and unreadable where they
        // do not, so the opening view follows the width.
        defaultViewMode={{ mobile: "contacts", desktop: "list" }}
        mobileRow={{
          // Overdue outranks priority: a late task needs answering whatever its
          // priority was when it was set.
          title: (t) => t.title,
          subtitle: (t) =>
            [
              t.work_item_number || null,
              `Weight ${t.weight ?? TASK_WEIGHT_DEFAULT}`,
              t.due_date ? `Due ${formatWATDate(t.due_date)}` : "No deadline",
              t.kpi_measure || t.goal_title || null,
              (t.comment_count || 0) > 0 ? `${t.comment_count} comment${t.comment_count === 1 ? "" : "s"}` : null,
            ]
              .filter(Boolean)
              .join(" · "),
          trailing: (t) => <TaskStatusPill status={t.status} />,
          detail: {
            title: (t) => t.title,
            subtitle: (t) => t.work_item_number || undefined,
            badges: (t) => (
              <>
                <TaskStatusPill status={t.status} />
                <Badge
                  variant="outline"
                  className={cn("font-mono text-[10px] font-medium", getTaskWeightBadgeClass(t.weight))}
                >
                  Weight {t.weight ?? TASK_WEIGHT_DEFAULT}
                </Badge>
              </>
            ),
            fields: (t) => [
              { label: "Item #", value: t.work_item_number || "-", copyable: true },
              { label: "Status", value: t.status.replace(/_/g, " ") },
              { label: "Task Weight", value: `${t.weight ?? TASK_WEIGHT_DEFAULT} (compulsory)` },
              {
                label: "Corporate KPI",
                value: t.kpi_measure ? `${t.kpi_measure}${t.kpi_pillar ? ` (🎯 ${t.kpi_pillar})` : ""}` : "—",
              },
              { label: "Strategic Goal", value: t.goal_title || "—" },
              { label: "Start Date", value: t.task_start_date ? formatWATDate(t.task_start_date) : "—" },
              { label: "Due Date", value: t.due_date ? formatWATDate(t.due_date) : "No deadline" },
              {
                label: "Assignee",
                value: t.assigned_to_user ? `${t.assigned_to_user.first_name} ${t.assigned_to_user.last_name}` : "-",
              },
              { label: "Department", value: t.department || t.assigned_to_user?.department || "-" },
              { label: "Description", value: t.description || null, fullWidth: true },
            ],
            actions: (t) => [
              {
                label: "View Full Details",
                onClick: () => void openTaskDetails(t),
              },
            ],
          },
        }}
        cardRenderer={(t) => (
          <div className="group bg-card text-card-foreground border-border/60 hover:border-primary/40 h-full space-y-3 rounded-xl border p-4 shadow-sm transition-all">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-foreground line-clamp-2 text-sm font-semibold">{t.title}</span>
                <span className="text-muted-foreground block font-mono text-xs">{t.work_item_number || "---"}</span>
              </div>
              <TaskStatusPill status={t.status} />
            </div>
            <div className="text-muted-foreground grid gap-1 text-xs">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                <span className={isTaskOverdue(t) ? "text-destructive font-semibold" : undefined}>
                  {t.due_date ? formatWATDate(t.due_date) : "No deadline"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{t.kpi_measure || t.goal_title || "—"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5 shrink-0" />
                <span>Weight {t.weight ?? TASK_WEIGHT_DEFAULT}</span>
              </div>
            </div>
          </div>
        )}
        emptyTitle="No tasks"
        emptyDescription="Tasks assigned to you will appear here."
        emptyIcon={ClipboardList}
        skeletonRows={6}
        urlSync
      />

      <UserTaskDetailsDialog
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        selectedTask={selectedTask}
        taskUpdates={taskUpdates}
        canReview={selectedTask ? canReviewTask(selectedTask) : false}
        ratingBlockedReason={selectedTask ? ratingBlockedReasonFor(selectedTask) : null}
        onChanged={async () => {
          const loaded = await loadTasks()
          if (loaded && selectedTask) {
            setSelectedTask(loaded.find((entry) => entry.id === selectedTask.id) ?? null)
          }
        }}
        onAddComment={postComment}
        isPostingComment={isPostingComment}
      />
    </DataTablePage>
  )
}
