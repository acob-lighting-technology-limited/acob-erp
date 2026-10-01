"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/patterns"
import { ArrowRight, CalendarClock, CheckCircle2, ClipboardList, Package, Plane, Utensils } from "lucide-react"
import { formatWATDate, toLocalISODate } from "@/lib/utils/date"
import { cn } from "@/lib/utils"
import {
  ATTENDANCE_STATUS_COLORS,
  ATTENDANCE_STATUS_LABELS,
  type UnifiedAttendanceStatus,
} from "@/lib/hr/attendance-status"
import type { Task, Asset, LeaveItem, LunchLogItem, WorkDayAttendanceItem } from "@/app/(app)/profile/page"
import { getTaskUrgency, sortTasksByUrgency } from "./work-items"

const MAX_TASKS = 6
const MAX_LEAVE_ITEMS = 5
const MAX_ASSETS = 4
const MAX_LUNCH_LOGS = 5

function shortDate(dateString: string): string {
  return formatWATDate(dateString, { month: "short", day: "numeric" })
}

function statusBadgeClass(status: string): string {
  switch (status?.toLowerCase()) {
    case "completed":
    case "resolved":
    case "approved":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    case "in_progress":
    case "under_review":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
    case "pending":
    case "open":
    case "new":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
    case "assigned":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
    case "rejected":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
  }
}

function humanizeStatus(status: string): string {
  return String(status || "").replaceAll("_", " ")
}

interface ListCardProps {
  title: string
  icon: React.ElementType
  count?: number
  viewAllHref: string
  viewAllLabel: string
  className?: string
  children: React.ReactNode
}

function ListCard({ title, icon: Icon, count, viewAllHref, viewAllLabel, className, children }: ListCardProps) {
  return (
    <Card className={cn("flex h-full flex-col", className)}>
      <CardHeader className="flex shrink-0 flex-row items-center justify-between space-y-0 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="text-muted-foreground h-4 w-4" />
          {title}
          {typeof count === "number" && count > 0 && (
            <span className="text-muted-foreground text-xs font-normal tabular-nums">({count})</span>
          )}
        </CardTitle>
        <Link href={viewAllHref} className="text-muted-foreground hover:text-foreground text-xs transition-colors">
          {viewAllLabel} →
        </Link>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">{children}</CardContent>
    </Card>
  )
}

function Row({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li className="hover:bg-muted/40 transition-colors">
      <Link href={href} className="flex items-center gap-3 px-4 py-2.5">
        <div className="min-w-0 flex-1">{children}</div>
        <ArrowRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
      </Link>
    </li>
  )
}

/* ------------------------------ My Tasks ------------------------------ */

function TaskDueBadge({ task, now }: { task: Task; now: Date }) {
  const urgency = getTaskUrgency(task, now)
  if (urgency.kind === "overdue") {
    return <span className="text-xs font-medium text-red-600 dark:text-red-400">{urgency.days}d overdue</span>
  }
  if (urgency.kind === "due_soon") {
    return (
      <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
        {urgency.days === 0 ? "Due today" : `Due in ${urgency.days}d`}
      </span>
    )
  }
  if (urgency.kind === "scheduled") {
    return <span className="text-muted-foreground text-xs">Due {shortDate(urgency.dueDate)}</span>
  }
  if (urgency.kind === "awaiting_review") {
    return <span className="text-muted-foreground text-xs">With reviewer</span>
  }
  if (urgency.kind === "blocked") {
    return <span className="text-muted-foreground text-xs">Reported blocked</span>
  }
  return <span className="text-muted-foreground text-xs">No due date</span>
}

export function MyTasksCard({ tasks }: { tasks: Task[] }) {
  const now = new Date()
  const openTasks = sortTasksByUrgency(tasks, now)
  const visible = openTasks.slice(0, MAX_TASKS)

  return (
    <ListCard
      title="My Tasks"
      icon={ClipboardList}
      count={openTasks.length}
      viewAllHref="/tasks"
      viewAllLabel="All tasks"
    >
      {visible.length > 0 ? (
        <ul className="flex-1 divide-y overflow-y-auto border-t">
          {visible.map((task) => (
            <Row key={task.id} href={`/tasks?taskId=${task.id}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-medium">{task.title}</p>
                <div className="shrink-0">
                  <TaskDueBadge task={task} now={now} />
                </div>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <Badge className={cn("px-1.5 py-0 text-[10px] capitalize", statusBadgeClass(task.status))}>
                  {humanizeStatus(task.status)}
                </Badge>
                {task.priority && (
                  <span className="text-muted-foreground text-[10px] capitalize">{task.priority} priority</span>
                )}
              </div>
            </Row>
          ))}
        </ul>
      ) : (
        <div className="flex flex-1 items-center justify-center border-t px-6 py-8">
          <EmptyState
            title="All caught up"
            description="No open tasks assigned to you right now."
            icon={CheckCircle2}
            className="border-0 py-2"
          />
        </div>
      )}
    </ListCard>
  )
}

/* -------------------------------- My Leave -------------------------------- */

type LeaveState = "on_leave" | "upcoming" | "pending" | "pending_evidence"

const LEAVE_STATE_LABELS: Record<LeaveState, string> = {
  on_leave: "On leave now",
  upcoming: "Approved",
  pending: "Awaiting approval",
  pending_evidence: "Evidence needed",
}

const LEAVE_STATE_CLASSES: Record<LeaveState, string> = {
  on_leave: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  upcoming: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  pending_evidence: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
}

// Ongoing leave first, then anything waiting on the employee, then the queue.
const LEAVE_STATE_RANK: Record<LeaveState, number> = { on_leave: 0, pending_evidence: 1, pending: 2, upcoming: 3 }

/**
 * Only leave that still matters: running now, coming up, or not yet decided.
 * Past, rejected and cancelled requests live on /hr/leave. Dates are
 * `YYYY-MM-DD` strings, so they compare as strings with no timezone involved.
 */
function leaveState(item: LeaveItem, todayIso: string): LeaveState | null {
  if (item.status === "pending") return "pending"
  if (item.status === "pending_evidence") return "pending_evidence"
  if (item.status !== "approved" || item.end_date < todayIso) return null
  return item.start_date <= todayIso ? "on_leave" : "upcoming"
}

function leaveDateRange(item: LeaveItem): string {
  const opts = { weekday: "short", month: "short", day: "numeric" } as const
  if (item.start_date === item.end_date) return formatWATDate(item.start_date, opts)
  return `${formatWATDate(item.start_date, opts)} – ${formatWATDate(item.end_date, opts)}`
}

export function LeaveCard({ leave, className }: { leave: LeaveItem[]; className?: string }) {
  const todayIso = toLocalISODate()
  const current = leave
    .map((item) => ({ item, state: leaveState(item, todayIso) }))
    .filter((entry): entry is { item: LeaveItem; state: LeaveState } => entry.state !== null)
    .sort(
      (a, b) =>
        LEAVE_STATE_RANK[a.state] - LEAVE_STATE_RANK[b.state] ||
        (a.item.start_date < b.item.start_date ? -1 : a.item.start_date > b.item.start_date ? 1 : 0)
    )
  const visible = current.slice(0, MAX_LEAVE_ITEMS)

  return (
    <ListCard
      title="My Leave"
      icon={Plane}
      count={current.length}
      viewAllHref="/hr/leave"
      viewAllLabel="All leave"
      className={className}
    >
      {visible.length > 0 ? (
        <ul className="flex-1 divide-y overflow-y-auto border-t">
          {visible.map(({ item, state }) => (
            <Row key={item.id} href="/hr/leave">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{item.leave_type}</p>
                <Badge className={cn("shrink-0 px-1.5 py-0 text-[10px]", LEAVE_STATE_CLASSES[state])}>
                  {LEAVE_STATE_LABELS[state]}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-0.5 text-[11px]">
                {leaveDateRange(item)}
                {item.days_requested > 0 && (
                  <span className="tabular-nums">
                    {" "}
                    · {item.days_requested} {item.days_requested === 1 ? "day" : "days"}
                  </span>
                )}
              </p>
            </Row>
          ))}
        </ul>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 border-t px-6 py-8">
          <EmptyState
            title="No upcoming leave"
            description="Approved and pending leave requests will appear here."
            icon={Plane}
            className="border-0 py-2"
          />
          <Link href="/hr/leave" className="text-primary text-xs font-medium hover:underline">
            Request leave →
          </Link>
        </div>
      )}
    </ListCard>
  )
}

/* ------------------------------ My Assets ----------------------------- */

export function AssetsCard({ assets, className }: { assets: Asset[]; className?: string }) {
  const visible = assets.slice(0, MAX_ASSETS)

  return (
    <ListCard
      title="My Assets"
      icon={Package}
      count={assets.length}
      viewAllHref="/accounts/assets"
      viewAllLabel="All assets"
      className={className}
    >
      {visible.length > 0 ? (
        <ul className="flex-1 divide-y overflow-y-auto border-t">
          {visible.map((asset) => (
            <Row key={`${asset.id}-${asset.assignment_type ?? "own"}`} href="/accounts/assets">
              <p className="truncate text-sm font-medium">
                {asset.asset_type}
                {asset.asset_model ? ` — ${asset.asset_model}` : ""}
              </p>
              <p className="text-muted-foreground mt-0.5 font-mono text-[10px]">{asset.unique_code || "—"}</p>
            </Row>
          ))}
        </ul>
      ) : (
        <div className="flex flex-1 items-center justify-center border-t px-6 py-8">
          <EmptyState
            title="No assets assigned"
            description="Company assets assigned to you will appear here."
            icon={Package}
            className="border-0 py-2"
          />
        </div>
      )}
    </ListCard>
  )
}

function formatClockTime(value: string | null | undefined): string {
  if (!value || value === "-") return "-"
  const parts = value.split(":")
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`
  }
  return value
}

/* ------------------------- Recent Workday Attendance ------------------------- */

export function RecentAttendanceCard({ items }: { items: WorkDayAttendanceItem[] }) {
  const todayIso = toLocalISODate()

  return (
    <ListCard
      title="Recent Attendance"
      icon={CalendarClock}
      count={items.length}
      viewAllHref="/hr/attendance"
      viewAllLabel="All records"
    >
      {items.length > 0 ? (
        <ul className="flex-1 divide-y overflow-y-auto border-t">
          {items.map((item) => {
            const isToday = item.date === todayIso
            const clockIn = formatClockTime(item.clock_in)
            const clockOut = formatClockTime(item.clock_out)
            const statusKey = item.status as UnifiedAttendanceStatus
            const statusLabel =
              item.status === "not_clocked_in"
                ? "Not Clocked In"
                : ATTENDANCE_STATUS_LABELS[statusKey] || humanizeStatus(item.status)
            const statusColor =
              item.status === "not_clocked_in"
                ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                : ATTENDANCE_STATUS_COLORS[statusKey] || statusBadgeClass(item.status)

            return (
              <Row key={item.date} href="/hr/attendance">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-foreground text-xs font-semibold">
                    {formatWATDate(item.date, { weekday: "short", month: "short", day: "numeric" })}
                    {isToday && <span className="text-muted-foreground ml-1 font-normal">(Today)</span>}
                  </p>
                  <Badge
                    variant="outline"
                    className={cn("shrink-0 border px-1.5 py-0 text-[10px] font-medium", statusColor)}
                  >
                    {statusLabel}
                  </Badge>
                </div>
                <div className="text-muted-foreground mt-0.5 flex items-center justify-between text-[11px]">
                  <span>
                    {item.clock_in ? (
                      <>
                        <span>
                          In: <strong className="text-foreground font-mono">{clockIn}</strong>
                        </span>
                        <span className="mx-1.5">·</span>
                        <span>
                          Out:{" "}
                          <strong className="text-foreground font-mono">
                            {clockOut !== "-" ? clockOut : isToday ? "Active" : "—"}
                          </strong>
                        </span>
                      </>
                    ) : item.status === "on_leave" || item.status === "lwop" ? (
                      <span className="text-purple-600 dark:text-purple-400">{item.leave_type || "On Leave"}</span>
                    ) : item.status === "exempted" ? (
                      <span className="text-violet-600 dark:text-violet-400">Attendance exempt</span>
                    ) : isToday ? (
                      <span className="text-muted-foreground">Not clocked in yet</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">No clock-in</span>
                    )}
                  </span>
                </div>
              </Row>
            )
          })}
        </ul>
      ) : (
        <div className="flex flex-1 items-center justify-center border-t px-6 py-8 text-center">
          <EmptyState
            title="No attendance records"
            description="Recent working day attendance will appear here."
            icon={CalendarClock}
            className="border-0 py-2"
          />
        </div>
      )}
    </ListCard>
  )
}

/* ------------------------------ My Lunch History ----------------------------- */

export function LunchHistoryCard({ lunchLogs }: { lunchLogs: LunchLogItem[] }) {
  const currentMonthName = new Date().toLocaleString("en-US", { month: "long" })
  const thisMonthLogs = lunchLogs.filter((log) => {
    const logDate = new Date(log.date)
    const now = new Date()
    return logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear()
  })

  const totalDeduction = thisMonthLogs.reduce((sum, log) => sum + Number(log.employee_deduction), 0)
  const recentLogs = lunchLogs.slice(0, MAX_LUNCH_LOGS)

  return (
    <ListCard title="Lunch History" icon={Utensils} viewAllHref="/hr/lunch?tab=history" viewAllLabel="All logs">
      {/* Lunch deductions are routine, not a fault - neutral text, with the
          subsidy noted once here rather than on every row. */}
      <div className="bg-muted/30 flex shrink-0 items-center justify-between border-t border-b px-4 py-3 text-sm">
        <div>
          <p className="text-muted-foreground font-medium">{currentMonthName} deductions</p>
          <p className="text-muted-foreground text-[10px]">Your share, after the company meal subsidy</p>
        </div>
        <span className="font-mono font-semibold tabular-nums">
          ₦{totalDeduction.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </span>
      </div>
      {recentLogs.length > 0 ? (
        <ul className="flex-1 divide-y overflow-y-auto">
          {recentLogs.map((log) => (
            <li key={log.id} className="flex items-center justify-between px-4 py-2.5 text-xs">
              <div>
                <p className="text-foreground font-semibold">
                  {formatWATDate(log.date, { weekday: "short", month: "short", day: "numeric" })}
                </p>
                <p className="text-muted-foreground text-[10px]">Meal price: ₦{Number(log.cost).toLocaleString()}</p>
              </div>
              <span className="font-mono font-medium tabular-nums">
                ₦{Number(log.employee_deduction).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-1 items-center justify-center border-t px-6 py-8 text-center">
          <EmptyState
            title="No lunch entries"
            description="Your recent lunch registers will appear here."
            icon={Utensils}
            className="border-0 py-2"
          />
        </div>
      )}
    </ListCard>
  )
}
