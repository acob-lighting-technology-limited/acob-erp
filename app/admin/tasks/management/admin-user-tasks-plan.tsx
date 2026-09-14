"use client"

import { useMemo, useState } from "react"
import { Calendar, CheckCircle2, Layers, Star, TrendingUp, Users, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { DataTable } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { cn, formatFullName } from "@/lib/utils"
import { formatWATDate, toLocalISODate } from "@/lib/utils/date"
import { monthBounds, toLocalYearMonth } from "@/lib/hr/attendance-utils"
import { getCurrentOfficeWeek, getOfficeWeekMonday } from "@/lib/meeting-week"
import {
  TASK_WEIGHT_DEFAULT,
  getTaskWeightBadgeClass,
  taskCycleAnchor,
  computeWeightedTaskScore,
} from "@/lib/tasks/scoring"
import type { Task, employee, UserProfile } from "./admin-tasks-content"
import { AdminTaskStatusBadge } from "./admin-tasks-content"

export interface ReviewCycleOption {
  id: string
  name: string
  review_type: string | null
  start_date: string | null
  end_date: string | null
  status?: string | null
}

export interface UserPlanRow {
  id: string
  userId: string
  name: string
  email: string
  department: string
  totalTasks: number
  completedCount: number
  inProgressCount: number
  pendingCount: number
  submittedCount: number
  otherCount: number
  totalWeight: number
  ratedCount: number
  avgRating: number | null
  kpiScore: number | null
  completionRate: number
  tasks: Task[]
}

// Stable default: a fresh [] each render changes hook deps and can loop effects.
const EMPTY_CYCLES: ReviewCycleOption[] = []

interface AdminUserTasksPlanProps {
  tasks: Task[]
  employees: employee[]
  departments: string[]
  cycles?: ReviewCycleOption[]
  userProfile: UserProfile
  onOpenTaskDialog: (task?: Task) => void
  onOpenReviewDialog: (task: Task) => void
}

function addDaysToDate(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function isTaskAssignedToUser(task: Task, user: employee): boolean {
  if (task.assigned_to === user.id) return true
  if (
    Array.isArray(task.assigned_users) &&
    task.assigned_users.some((u) => (typeof u === "string" ? u === user.id : u?.id === user.id))
  ) {
    return true
  }
  if (
    task.assignment_type === "department" &&
    task.department &&
    user.department &&
    task.department.toLowerCase() === user.department.toLowerCase()
  ) {
    return true
  }
  return false
}

export function AdminUserTasksPlan({
  tasks,
  employees,
  departments,
  cycles = EMPTY_CYCLES,
  userProfile: _userProfile,
  onOpenTaskDialog,
  onOpenReviewDialog,
}: AdminUserTasksPlanProps) {
  const currentWeekInfo = useMemo(() => getCurrentOfficeWeek(), [])
  const currentYear = new Date().getFullYear()

  // Period filter state — driven directly by DataTable's single-select filter
  const [selectedPeriod, setSelectedPeriod] = useState<string>("this_week")

  // Options for the Time Period filter dropdown
  const periodOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [
      { value: "this_week", label: `This Week (W${currentWeekInfo.week})` },
      { value: "last_week", label: `Last Week (W${currentWeekInfo.week > 1 ? currentWeekInfo.week - 1 : 52})` },
      { value: "today", label: "Today" },
      { value: "this_month", label: "This Month" },
      { value: "last_month", label: "Last Month" },
      { value: "this_year", label: `This Year (${currentYear})` },
      { value: "last_year", label: `Last Year (${currentYear - 1})` },
    ]

    if (cycles && cycles.length > 0) {
      for (const cycle of cycles) {
        opts.push({
          value: `cycle_${cycle.id}`,
          label: `Cycle: ${cycle.name}`,
        })
      }
    }

    for (let w = currentWeekInfo.week - 2; w >= Math.max(1, currentWeekInfo.week - 8); w--) {
      opts.push({
        value: `week_${w}`,
        label: `Week ${w}, ${currentYear}`,
      })
    }

    return opts
  }, [currentWeekInfo, currentYear, cycles])

  // Resolve active date bounds [startIso, endIso]
  const dateBounds = useMemo<{ start: string; end: string; description: string }>(() => {
    if (selectedPeriod === "this_week") {
      const monday = getOfficeWeekMonday(currentWeekInfo.week, currentWeekInfo.year)
      const sunday = addDaysToDate(monday, 6)
      const start = toLocalISODate(monday)
      const end = toLocalISODate(sunday)
      return {
        start,
        end,
        description: `This Week (W${currentWeekInfo.week}: ${formatWATDate(start)} – ${formatWATDate(end)})`,
      }
    }

    if (selectedPeriod === "last_week") {
      const lastWeekNum = currentWeekInfo.week > 1 ? currentWeekInfo.week - 1 : 52
      const lastWeekYear = currentWeekInfo.week > 1 ? currentWeekInfo.year : currentWeekInfo.year - 1
      const monday = getOfficeWeekMonday(lastWeekNum, lastWeekYear)
      const sunday = addDaysToDate(monday, 6)
      const start = toLocalISODate(monday)
      const end = toLocalISODate(sunday)
      return {
        start,
        end,
        description: `Last Week (W${lastWeekNum}: ${formatWATDate(start)} – ${formatWATDate(end)})`,
      }
    }

    if (selectedPeriod === "today") {
      const today = toLocalISODate()
      return {
        start: today,
        end: today,
        description: `Today (${formatWATDate(today)})`,
      }
    }

    if (selectedPeriod === "this_month") {
      const monthStr = toLocalYearMonth()
      const bounds = monthBounds(monthStr)
      return {
        start: bounds.start,
        end: bounds.end,
        description: `This Month (${monthStr})`,
      }
    }

    if (selectedPeriod === "last_month") {
      const now = new Date()
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`
      const bounds = monthBounds(lastMonthStr)
      return {
        start: bounds.start,
        end: bounds.end,
        description: `Last Month (${lastMonthStr})`,
      }
    }

    if (selectedPeriod === "this_year") {
      return {
        start: `${currentYear}-01-01`,
        end: `${currentYear}-12-31`,
        description: `Year ${currentYear}`,
      }
    }

    if (selectedPeriod === "last_year") {
      return {
        start: `${currentYear - 1}-01-01`,
        end: `${currentYear - 1}-12-31`,
        description: `Year ${currentYear - 1}`,
      }
    }

    if (selectedPeriod.startsWith("cycle_")) {
      const cycleId = selectedPeriod.replace("cycle_", "")
      const cycle = cycles.find((c) => c.id === cycleId)
      const start = cycle?.start_date ? cycle.start_date.slice(0, 10) : ""
      const end = cycle?.end_date ? cycle.end_date.slice(0, 10) : ""
      return {
        start,
        end,
        description: cycle ? `${cycle.name} (${cycle.review_type || "Cycle"})` : "Review Cycle",
      }
    }

    if (selectedPeriod.startsWith("week_")) {
      const weekNum = parseInt(selectedPeriod.replace("week_", ""), 10)
      if (!isNaN(weekNum)) {
        const monday = getOfficeWeekMonday(weekNum, currentYear)
        const sunday = addDaysToDate(monday, 6)
        const start = toLocalISODate(monday)
        const end = toLocalISODate(sunday)
        return {
          start,
          end,
          description: `Week ${weekNum}, ${currentYear} (${formatWATDate(start)} – ${formatWATDate(end)})`,
        }
      }
    }

    return { start: "", end: "", description: "All Time" }
  }, [selectedPeriod, currentWeekInfo, currentYear, cycles])

  // Filter tasks strictly by the date window
  const filteredTasks = useMemo(() => {
    const { start, end } = dateBounds
    if (!start && !end) return tasks

    return tasks.filter((task) => {
      const anchor = taskCycleAnchor(task)
      if (!anchor) return false
      if (start && anchor < start) return false
      if (end && anchor > end) return false
      return true
    })
  }, [tasks, dateBounds])

  // Map assignable employees to aggregated UserPlanRow
  const userPlanRows = useMemo<UserPlanRow[]>(() => {
    return employees.map((emp) => {
      const userTasks = filteredTasks.filter((t) => isTaskAssignedToUser(t, emp))

      let completedCount = 0
      let inProgressCount = 0
      let pendingCount = 0
      let submittedCount = 0
      let otherCount = 0
      let totalWeight = 0
      let ratingSum = 0
      let ratedCount = 0

      for (const t of userTasks) {
        const status = (t.status || "pending").toLowerCase()
        if (status === "completed") completedCount++
        else if (status === "in_progress") inProgressCount++
        else if (status === "pending") pendingCount++
        else if (status === "submitted_for_review") submittedCount++
        else otherCount++

        totalWeight += t.weight ?? TASK_WEIGHT_DEFAULT

        if (typeof t.rating === "number" && t.rating > 0) {
          ratingSum += t.rating
          ratedCount++
        }
      }

      const avgRating = ratedCount > 0 ? Math.round((ratingSum / ratedCount) * 10) / 10 : null
      const weightedScore = computeWeightedTaskScore(userTasks)
      const completionRate = userTasks.length > 0 ? Math.round((completedCount / userTasks.length) * 100) : 0

      return {
        id: emp.id,
        userId: emp.id,
        name: formatFullName(emp.first_name, emp.last_name) || emp.company_email,
        email: emp.company_email,
        department: emp.department || "Unassigned",
        totalTasks: userTasks.length,
        completedCount,
        inProgressCount,
        pendingCount,
        submittedCount,
        otherCount,
        totalWeight,
        ratedCount,
        avgRating,
        kpiScore: weightedScore.score,
        completionRate,
        tasks: userTasks,
      }
    })
  }, [employees, filteredTasks])

  // Overall statistics for top StatCards
  const stats = useMemo(() => {
    const activeUsers = userPlanRows.filter((r) => r.totalTasks > 0).length
    const totalTasksCount = filteredTasks.length
    const totalWeightSum = userPlanRows.reduce((sum, r) => sum + r.totalWeight, 0)
    const ratedRows = userPlanRows.filter((r) => r.avgRating !== null)
    const overallAvgRating =
      ratedRows.length > 0
        ? Math.round((ratedRows.reduce((sum, r) => sum + (r.avgRating ?? 0), 0) / ratedRows.length) * 10) / 10
        : null
    const totalCompleted = userPlanRows.reduce((sum, r) => sum + r.completedCount, 0)
    const overallCompletionPct = totalTasksCount > 0 ? Math.round((totalCompleted / totalTasksCount) * 100) : 0

    return {
      activeUsers,
      totalUsers: userPlanRows.length,
      totalTasksCount,
      totalWeightSum,
      overallAvgRating,
      overallCompletionPct,
    }
  }, [userPlanRows, filteredTasks])

  // DataTable columns
  const columns = useMemo<DataTableColumn<UserPlanRow>[]>(
    () => [
      {
        key: "name",
        label: "Employee",
        sortable: true,
        accessor: (r) => r.name,
        render: (r) => (
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase">
              {r.name.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{r.name}</p>
              <p className="text-muted-foreground truncate text-xs">{r.email}</p>
            </div>
          </div>
        ),
      },
      {
        key: "department",
        label: "Department",
        sortable: true,
        accessor: (r) => r.department,
        render: (r) => <Badge variant="outline">{r.department}</Badge>,
      },
      {
        key: "totalTasks",
        label: "Tasks",
        sortable: true,
        accessor: (r) => r.totalTasks,
        render: (r) => (
          <Badge variant={r.totalTasks > 0 ? "secondary" : "outline"} className="font-mono text-xs">
            {r.totalTasks} {r.totalTasks === 1 ? "task" : "tasks"}
          </Badge>
        ),
      },
      {
        key: "breakdown",
        label: "Status Breakdown",
        render: (r) => {
          if (r.totalTasks === 0) {
            return <span className="text-muted-foreground text-xs italic">No tasks in period</span>
          }
          return (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              {r.completedCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {r.completedCount} done
                </span>
              )}
              {r.inProgressCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded bg-sky-500/10 px-1.5 py-0.5 font-medium text-sky-600 dark:text-sky-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                  {r.inProgressCount} in prog
                </span>
              )}
              {r.submittedCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded bg-purple-500/10 px-1.5 py-0.5 font-medium text-purple-600 dark:text-purple-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                  {r.submittedCount} review
                </span>
              )}
              {r.pendingCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-600 dark:text-amber-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {r.pendingCount} pending
                </span>
              )}
              {r.otherCount > 0 && (
                <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium">
                  {r.otherCount} other
                </span>
              )}
            </div>
          )
        },
      },
      {
        key: "totalWeight",
        label: "Total Weight",
        sortable: true,
        accessor: (r) => r.totalWeight,
        render: (r) => <span className="font-mono text-sm font-semibold">{r.totalWeight} pts</span>,
      },
      {
        key: "avgRating",
        label: "Avg Rating",
        sortable: true,
        accessor: (r) => r.avgRating ?? -1,
        render: (r) => {
          if (r.avgRating === null) {
            return <span className="text-muted-foreground text-xs">Unrated</span>
          }
          return (
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span>{r.avgRating.toFixed(1)} / 5</span>
              <span className="text-muted-foreground text-[10px] font-normal">({r.ratedCount} rated)</span>
            </div>
          )
        },
      },
      {
        key: "kpiScore",
        label: "KPI Attainment",
        sortable: true,
        accessor: (r) => r.kpiScore ?? -1,
        render: (r) => {
          if (r.kpiScore === null) {
            return <span className="text-muted-foreground text-xs">-</span>
          }
          const score = r.kpiScore
          let color = "text-muted-foreground"
          if (score >= 80) color = "text-emerald-600 dark:text-emerald-400 font-bold"
          else if (score >= 60) color = "text-sky-600 dark:text-sky-400 font-medium"
          else if (score >= 40) color = "text-amber-600 dark:text-amber-400 font-medium"
          else color = "text-destructive font-medium"

          return <span className={cn("font-mono text-xs", color)}>{score}%</span>
        },
      },
    ],
    []
  )

  const filters = useMemo<DataTableFilter<UserPlanRow>[]>(() => {
    return [
      {
        key: "department",
        label: "Department",
        options: departments.map((d) => ({ value: d, label: d })),
      },
      {
        key: "period",
        label: "Time Period",
        multi: false,
        placeholder: "All Time",
        defaultValues: ["this_week"],
        options: periodOptions,
        mode: "custom",
        filterFn: () => true,
      },
      {
        key: "activity",
        label: "Task Activity",
        options: [
          { value: "with_tasks", label: "Has Tasks in Period" },
          { value: "without_tasks", label: "No Tasks in Period" },
        ],
        mode: "custom",
        filterFn: (row, values) => {
          if (values.length === 0) return true
          if (values.includes("with_tasks") && row.totalTasks > 0) return true
          if (values.includes("without_tasks") && row.totalTasks === 0) return true
          return false
        },
      },
    ]
  }, [departments, periodOptions])

  const handlePeriodFilterChange = (fv: Record<string, string[]>) => {
    const p = fv["period"]?.[0] || "all"
    setSelectedPeriod(p)
  }

  return (
    <div className="space-y-4">
      {/* ── Top Stat Cards ── */}
      <StatGrid>
        <StatCard
          variant="compact"
          title="Active Users"
          value={`${stats.activeUsers} / ${stats.totalUsers}`}
          icon={Users}
          iconBgColor="bg-blue-500/10"
          iconColor="text-blue-500"
          description="Users with tasks in period"
        />
        <StatCard
          variant="compact"
          title="Filtered Tasks"
          value={stats.totalTasksCount}
          icon={Layers}
          iconBgColor="bg-purple-500/10"
          iconColor="text-purple-500"
          description="Due in selected window"
        />
        <StatCard
          variant="compact"
          title="Total Weight"
          value={`${stats.totalWeightSum} pts`}
          icon={TrendingUp}
          iconBgColor="bg-teal-500/10"
          iconColor="text-teal-500"
          description="Combined task points"
        />
        <StatCard
          variant="compact"
          title="Avg Rating"
          value={stats.overallAvgRating !== null ? `${stats.overallAvgRating} / 5` : "Unrated"}
          icon={Star}
          iconBgColor="bg-amber-500/10"
          iconColor="text-amber-500"
          description="Rater scoring average"
        />
        <StatCard
          variant="compact"
          title="Completed Rate"
          value={`${stats.overallCompletionPct}%`}
          icon={CheckCircle2}
          iconBgColor="bg-emerald-500/10"
          iconColor="text-emerald-500"
          description="Delivery percentage"
        />
      </StatGrid>

      {/* ── User Tasks Table with Expandable Row ── */}
      <DataTable<UserPlanRow>
        data={userPlanRows}
        columns={columns}
        getRowId={(r) => r.id}
        pagination={{ pageSize: 50 }}
        searchPlaceholder="Search employee name, email, or department..."
        searchFn={(r, q) => `${r.name} ${r.email} ${r.department}`.toLowerCase().includes(q.toLowerCase())}
        filters={filters}
        onFilterChange={handlePeriodFilterChange}
        onFilterValuesChange={handlePeriodFilterChange}
        emptyTitle="No Employees Found"
        emptyDescription="No employees match the current filters or department scope."
        emptyIcon={Users}
        viewToggle
        contactsView
        stickyToolbar
        defaultViewMode={{ mobile: "contacts", desktop: "list" }}
        mobileRow={{
          title: (r) => r.name,
          subtitle: (r) =>
            `${r.department} · ${r.totalTasks} tasks · ${r.totalWeight} pts · Rate: ${r.completionRate}%`,
          trailing: (r) => (
            <Badge variant="outline" className="font-mono text-[10px]">
              {r.avgRating !== null ? `★ ${r.avgRating}` : "Unrated"}
            </Badge>
          ),
          detail: {
            title: (r) => r.name,
            subtitle: (r) => `${r.department} · ${r.email}`,
            badges: (r) => (
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">
                  {r.totalTasks} tasks
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {r.totalWeight} weight pts
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {r.completionRate}% completed
                </Badge>
              </div>
            ),
            fields: (r) => [
              { label: "Employee", value: r.name },
              { label: "Department", value: r.department },
              { label: "Email", value: r.email },
              { label: "Total Tasks", value: String(r.totalTasks) },
              { label: "Completed", value: String(r.completedCount) },
              { label: "In Progress", value: String(r.inProgressCount) },
              { label: "Pending", value: String(r.pendingCount) },
              { label: "Total Weight Points", value: `${r.totalWeight} pts` },
              { label: "Average Rating", value: r.avgRating !== null ? `${r.avgRating} / 5` : "Unrated" },
              { label: "Attainment Rate", value: `${r.completionRate}%` },
            ],
          },
        }}
        cardRenderer={(r) => (
          <div className="bg-card space-y-3 rounded-xl border p-4 text-xs transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold">{r.name}</p>
                <p className="text-muted-foreground text-[11px]">{r.department}</p>
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">
                {r.avgRating !== null ? `★ ${r.avgRating}` : "Unrated"}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 border-t pt-2 text-center text-[10px]">
              <div className="bg-muted/30 rounded p-1">
                <span className="text-muted-foreground block">Tasks</span>
                <span className="font-semibold">{r.totalTasks}</span>
              </div>
              <div className="bg-muted/30 rounded p-1">
                <span className="text-muted-foreground block">Weight</span>
                <span className="font-semibold">{r.totalWeight}</span>
              </div>
              <div className="bg-muted/30 rounded p-1">
                <span className="text-muted-foreground block">Rate</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{r.completionRate}%</span>
              </div>
            </div>
          </div>
        )}
        expandable={{
          canExpand: (row) => row.tasks.length > 0,
          render: (row) => (
            <div className="bg-muted/20 space-y-3 rounded-lg border p-3.5 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-foreground text-xs font-bold tracking-wider uppercase">
                    Assigned Tasks for {row.name}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {row.tasks.length} {row.tasks.length === 1 ? "task" : "tasks"} in {dateBounds.description} •{" "}
                    {row.totalWeight} total weight points
                  </p>
                </div>
              </div>

              <div className="bg-background overflow-x-auto rounded-lg border shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/60 text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
                    <tr>
                      <th className="px-3 py-2.5">Task</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Assignment</th>
                      <th className="px-3 py-2.5">Due Date</th>
                      <th className="px-3 py-2.5">Weight</th>
                      <th className="px-3 py-2.5">Rating</th>
                      <th className="px-3 py-2.5">Earned</th>
                      <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs">
                    {row.tasks.map((task) => {
                      const weight = task.weight ?? TASK_WEIGHT_DEFAULT
                      const rating = task.rating
                      const earned = rating ? Math.round(((weight * rating) / 5) * 100) / 100 : 0
                      const isOverdue =
                        task.due_date &&
                        new Date(task.due_date).getTime() < new Date().setHours(0, 0, 0, 0) &&
                        !["completed", "reassigned", "cancelled"].includes(task.status)

                      return (
                        <tr key={task.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2.5">
                            <p className="text-foreground font-semibold">{task.title}</p>
                            {task.description ? (
                              <p className="text-muted-foreground line-clamp-1 text-[11px]">{task.description}</p>
                            ) : null}
                            {task.work_item_number && (
                              <span className="text-muted-foreground font-mono text-[10px]">
                                {task.work_item_number}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <AdminTaskStatusBadge status={task.status} />
                          </td>
                          <td className="px-3 py-2.5 capitalize">
                            <Badge variant="outline" className="text-[10px]">
                              {String(task.assignment_type || "individual").replace(/_/g, " ")}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1">
                              <span
                                className={cn(isOverdue ? "text-destructive font-semibold" : "text-muted-foreground")}
                              >
                                {task.due_date ? formatWATDate(task.due_date) : "-"}
                              </span>
                              {isOverdue && <AlertTriangle className="text-destructive h-3 w-3" />}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge
                              variant="outline"
                              className={cn("font-mono text-xs", getTaskWeightBadgeClass(weight))}
                            >
                              Weight {weight}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 font-mono">
                            {rating ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                {rating} / 5
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Unrated</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono">
                            {rating ? (
                              <span>
                                {earned} / {weight}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => onOpenTaskDialog(task)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => onOpenReviewDialog(task)}
                              >
                                Review
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ),
        }}
      />
    </div>
  )
}
