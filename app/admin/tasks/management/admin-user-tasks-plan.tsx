"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Filter,
  Layers,
  Search,
  Star,
  TrendingUp,
  User,
  Users,
  AlertTriangle,
  RotateCcw,
} from "lucide-react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

export type PeriodFilterMode = "all" | "custom" | "day" | "week" | "month" | "cycle" | "year"

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

function PeriodFilterControl({
  periodMode,
  onPeriodModeChange,
  selectedDay,
  onDayChange,
  selectedWeek,
  onWeekChange,
  selectedWeekYear,
  onWeekYearChange,
  selectedMonth,
  onMonthChange,
  selectedCycleId,
  onCycleIdChange,
  selectedYear,
  onYearChange,
  customStartDate,
  onCustomStartDateChange,
  customEndDate,
  onCustomEndDateChange,
  weekOptions,
  yearOptions,
  cycles,
  description,
  selectedValues,
  onClear,
}: {
  periodMode: PeriodFilterMode
  onPeriodModeChange: (mode: PeriodFilterMode) => void
  selectedDay: string
  onDayChange: (day: string) => void
  selectedWeek: number
  onWeekChange: (week: number) => void
  selectedWeekYear: number
  onWeekYearChange: (year: number) => void
  selectedMonth: string
  onMonthChange: (month: string) => void
  selectedCycleId: string
  onCycleIdChange: (cycleId: string) => void
  selectedYear: number
  onYearChange: (year: number) => void
  customStartDate: string
  onCustomStartDateChange: (date: string) => void
  customEndDate: string
  onCustomEndDateChange: (date: string) => void
  weekOptions: number[]
  yearOptions: number[]
  cycles: ReviewCycleOption[]
  description: string
  selectedValues: string[]
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (selectedValues.length === 0 && periodMode !== "all") {
      onPeriodModeChange("all")
    }
  }, [selectedValues, periodMode, onPeriodModeChange])

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className={cn(
            "border-input ring-offset-background hover:bg-muted/50 focus:ring-ring flex h-9 w-full items-center justify-between rounded-lg border bg-transparent px-3 text-xs shadow-xs focus:ring-1 focus:outline-none",
            periodMode !== "all" ? "text-foreground font-medium" : "text-muted-foreground"
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            <Calendar className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{periodMode === "all" ? "All Time" : description}</span>
          </span>
          <ChevronDown className="text-muted-foreground ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className={cn(
            "bg-popover text-popover-foreground z-50 w-80 space-y-3 rounded-lg border p-3.5 shadow-md outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
          )}
        >
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-1.5">
              <Calendar className="text-primary h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Time Period Filter</span>
            </div>
            {periodMode !== "all" && (
              <button
                type="button"
                onClick={() => {
                  onPeriodModeChange("all")
                  onClear()
                }}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px]"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-muted-foreground block text-[11px] font-medium">Period Mode</label>
            <select
              value={periodMode}
              onChange={(e) => onPeriodModeChange(e.target.value as PeriodFilterMode)}
              className="border-input bg-background focus:ring-ring flex h-8 w-full rounded-md border px-2 text-xs shadow-xs focus:ring-1 focus:outline-none"
            >
              <option value="all">All Time</option>
              <option value="day">Specific Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="cycle">PMS Review Cycle</option>
              <option value="year">Year</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {periodMode === "day" && (
            <div className="space-y-1">
              <label className="text-muted-foreground block text-[11px] font-medium">Select Date</label>
              <Input
                type="date"
                value={selectedDay}
                onChange={(e) => onDayChange(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          )}

          {periodMode === "week" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-muted-foreground block text-[11px] font-medium">Office Week</label>
                <select
                  value={String(selectedWeek)}
                  onChange={(e) => onWeekChange(Number(e.target.value))}
                  className="border-input bg-background focus:ring-ring flex h-8 w-full rounded-md border px-2 text-xs shadow-xs focus:ring-1 focus:outline-none"
                >
                  {weekOptions.map((w) => (
                    <option key={w} value={String(w)}>
                      Week {w}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground block text-[11px] font-medium">Year</label>
                <select
                  value={String(selectedWeekYear)}
                  onChange={(e) => onWeekYearChange(Number(e.target.value))}
                  className="border-input bg-background focus:ring-ring flex h-8 w-full rounded-md border px-2 text-xs shadow-xs focus:ring-1 focus:outline-none"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {periodMode === "month" && (
            <div className="space-y-1">
              <label className="text-muted-foreground block text-[11px] font-medium">Select Month</label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => onMonthChange(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          )}

          {periodMode === "cycle" && (
            <div className="space-y-1">
              <label className="text-muted-foreground block text-[11px] font-medium">Select Review Cycle</label>
              <select
                value={selectedCycleId}
                onChange={(e) => onCycleIdChange(e.target.value)}
                className="border-input bg-background focus:ring-ring flex h-8 w-full rounded-md border px-2 text-xs shadow-xs focus:ring-1 focus:outline-none"
              >
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.review_type ? `(${c.review_type})` : ""}
                    {c.status === "active" ? " • Active" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {periodMode === "year" && (
            <div className="space-y-1">
              <label className="text-muted-foreground block text-[11px] font-medium">Select Year</label>
              <select
                value={String(selectedYear)}
                onChange={(e) => onYearChange(Number(e.target.value))}
                className="border-input bg-background focus:ring-ring flex h-8 w-full rounded-md border px-2 text-xs shadow-xs focus:ring-1 focus:outline-none"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {periodMode === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-muted-foreground block text-[11px] font-medium">Start Date</label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => onCustomStartDateChange(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground block text-[11px] font-medium">End Date</label>
                <Input
                  type="date"
                  value={customEndDate}
                  min={customStartDate}
                  onChange={(e) => onCustomEndDateChange(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}

          <div className="text-muted-foreground flex items-center justify-between border-t pt-2 text-[11px]">
            <span>Active window:</span>
            <Badge variant="secondary" className="text-[10px] font-normal">
              {description}
            </Badge>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

export function AdminUserTasksPlan({
  tasks,
  employees,
  departments,
  cycles = [],
  userProfile: _userProfile,
  onOpenTaskDialog,
  onOpenReviewDialog,
}: AdminUserTasksPlanProps) {
  const currentWeekInfo = useMemo(() => getCurrentOfficeWeek(), [])
  const currentYear = new Date().getFullYear()

  // Period filter states
  const [periodMode, setPeriodMode] = useState<PeriodFilterMode>("all")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")
  const [selectedDay, setSelectedDay] = useState(toLocalISODate())
  const [selectedWeek, setSelectedWeek] = useState(currentWeekInfo.week)
  const [selectedWeekYear, setSelectedWeekYear] = useState(currentWeekInfo.year)
  const [selectedMonth, setSelectedMonth] = useState(toLocalYearMonth())
  const [selectedCycleId, setSelectedCycleId] = useState(cycles[0]?.id || "")
  const [selectedYear, setSelectedYear] = useState(currentYear)

  const weekOptions = useMemo(() => Array.from({ length: 53 }, (_, i) => i + 1), [])
  const yearOptions = useMemo(() => [currentYear - 2, currentYear - 1, currentYear, currentYear + 1], [currentYear])

  // Resolve active date bounds [startIso, endIso]
  const dateBounds = useMemo<{ start: string; end: string; description: string }>(() => {
    if (periodMode === "day") {
      return {
        start: selectedDay,
        end: selectedDay,
        description: selectedDay ? formatWATDate(selectedDay) : "Specific Day",
      }
    }
    if (periodMode === "week") {
      const monday = getOfficeWeekMonday(selectedWeek, selectedWeekYear)
      const sunday = addDaysToDate(monday, 6)
      const start = toLocalISODate(monday)
      const end = toLocalISODate(sunday)
      return {
        start,
        end,
        description: `Week ${selectedWeek}, ${selectedWeekYear} (${formatWATDate(start)} – ${formatWATDate(end)})`,
      }
    }
    if (periodMode === "month") {
      const bounds = monthBounds(selectedMonth)
      return {
        start: bounds.start,
        end: bounds.end,
        description: selectedMonth,
      }
    }
    if (periodMode === "cycle") {
      const cycle = cycles.find((c) => c.id === selectedCycleId)
      const start = cycle?.start_date ? cycle.start_date.slice(0, 10) : ""
      const end = cycle?.end_date ? cycle.end_date.slice(0, 10) : ""
      return {
        start,
        end,
        description: cycle ? `${cycle.name} (${cycle.review_type || "Cycle"})` : "Review Cycle",
      }
    }
    if (periodMode === "year") {
      const start = `${selectedYear}-01-01`
      const end = `${selectedYear}-12-31`
      return {
        start,
        end,
        description: `Year ${selectedYear}`,
      }
    }
    if (periodMode === "custom") {
      return {
        start: customStartDate,
        end: customEndDate,
        description:
          customStartDate && customEndDate
            ? `${formatWATDate(customStartDate)} – ${formatWATDate(customEndDate)}`
            : "Custom Date Range",
      }
    }
    return { start: "", end: "", description: "All Time" }
  }, [
    periodMode,
    selectedDay,
    selectedWeek,
    selectedWeekYear,
    selectedMonth,
    selectedCycleId,
    selectedYear,
    customStartDate,
    customEndDate,
    cycles,
  ])

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

  // Filters
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
        defaultValues: ["week"],
        options: [
          {
            value: periodMode,
            label: dateBounds.description,
          },
        ],
        mode: "custom",
        filterFn: () => true,
        render: (selectedValues, onChange) => (
          <PeriodFilterControl
            periodMode={periodMode}
            onPeriodModeChange={(mode) => {
              setPeriodMode(mode)
              onChange(mode === "all" ? [] : [mode])
            }}
            selectedDay={selectedDay}
            onDayChange={(day) => {
              setSelectedDay(day)
              onChange([periodMode])
            }}
            selectedWeek={selectedWeek}
            onWeekChange={(week) => {
              setSelectedWeek(week)
              onChange([periodMode])
            }}
            selectedWeekYear={selectedWeekYear}
            onWeekYearChange={(year) => {
              setSelectedWeekYear(year)
              onChange([periodMode])
            }}
            selectedMonth={selectedMonth}
            onMonthChange={(month) => {
              setSelectedMonth(month)
              onChange([periodMode])
            }}
            selectedCycleId={selectedCycleId}
            onCycleIdChange={(cycleId) => {
              setSelectedCycleId(cycleId)
              onChange([periodMode])
            }}
            selectedYear={selectedYear}
            onYearChange={(year) => {
              setSelectedYear(year)
              onChange([periodMode])
            }}
            customStartDate={customStartDate}
            onCustomStartDateChange={(date) => {
              setCustomStartDate(date)
              onChange([periodMode])
            }}
            customEndDate={customEndDate}
            onCustomEndDateChange={(date) => {
              setCustomEndDate(date)
              onChange([periodMode])
            }}
            weekOptions={weekOptions}
            yearOptions={yearOptions}
            cycles={cycles}
            description={dateBounds.description}
            selectedValues={selectedValues}
            onClear={() => onChange([])}
          />
        ),
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
  }, [
    departments,
    periodMode,
    dateBounds.description,
    selectedDay,
    selectedWeek,
    selectedWeekYear,
    selectedMonth,
    selectedCycleId,
    selectedYear,
    customStartDate,
    customEndDate,
    weekOptions,
    yearOptions,
    cycles,
  ])

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
        emptyTitle="No Employees Found"
        emptyDescription="No employees match the current filters or department scope."
        emptyIcon={Users}
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
