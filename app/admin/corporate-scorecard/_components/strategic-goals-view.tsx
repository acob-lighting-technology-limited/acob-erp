"use client"

import { useEffect, useMemo, useState } from "react"
import type { DataTableTab } from "@/components/ui/data-table"
import { PmsTablePage } from "@/app/admin/pms/_components/pms-table-page"
import { RAG_AMBER_THRESHOLD, RAG_GREEN_THRESHOLD } from "@/lib/corporate-scorecard/attainment"
import type { StrategicGoalRow } from "@/app/api/corporate-scorecard/goals/route"
import { PlanYearSelect } from "./plan-year-select"

type GoalScope = "mine" | "department" | "all"

interface StrategicGoalsViewProps {
  scope: GoalScope
  department?: string | null
  backHref: string
  backLabel: string
  tabs?: DataTableTab[]
  activeTab?: string
  onTabChange?: (tab: string) => void
}

const SCOPE_COPY: Record<GoalScope, { description: string; tableDescription: string }> = {
  mine: {
    description: "The company goals your tasks are working towards.",
    tableDescription:
      "Each goal is a strategic objective from the corporate scorecard. Your tasks reach it through the KPI you pick when the task is created. Score is your weighted task score on that goal's tasks.",
  },
  department: {
    description: "The company goals your department owns or supports, and how much work is linked to each.",
    tableDescription:
      "A goal with no tasks has no work against it yet — assign tasks to its KPIs. Attainment is the average of the goal's core KPIs for this department.",
  },
  all: {
    description: "Every company goal, the work linked to it, and how far its KPIs have got.",
    tableDescription:
      "Goals are the strategic objectives of the corporate scorecard. A goal with no tasks has no work against it anywhere in the company.",
  },
}

function formatPercent(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value}%` : "-"
}

/** Text the shared status badge already colours: on target / needs attention / at risk. */
function goalStatus(row: StrategicGoalRow, scope: GoalScope): string {
  if (row.task_total === 0) return "No tasks yet"
  const pct = scope === "mine" ? row.task_score : row.attainment_pct
  if (pct == null) return scope === "mine" ? "Awaiting rating" : "No actual recorded"
  if (pct >= RAG_GREEN_THRESHOLD) return "on target"
  if (pct >= RAG_AMBER_THRESHOLD) return "needs attention"
  return "at risk"
}

/**
 * Goals tab for the KPI pages. Goals are the corporate scorecard's strategic
 * objectives — a task picks a KPI, the KPI belongs to an objective — so this
 * only reads and rolls up; nothing here is entered by hand or scored.
 */
export function StrategicGoalsView({
  scope,
  department,
  backHref,
  backLabel,
  tabs,
  activeTab,
  onTabChange,
}: StrategicGoalsViewProps) {
  const [goals, setGoals] = useState<StrategicGoalRow[]>([])
  // null = let the server pick (current year, or the latest loaded plan).
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [planYears, setPlanYears] = useState<{ year?: number; years?: number[] }>({})

  useEffect(() => {
    const params = new URLSearchParams({ scope })
    if (department) params.set("department", department)
    if (selectedYear) params.set("year", String(selectedYear))
    let cancelled = false
    fetch(`/api/corporate-scorecard/goals?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((payload) => {
        if (cancelled) return
        setGoals((payload.data ?? []) as StrategicGoalRow[])
        setPlanYears({ year: payload.year, years: payload.years })
      })
      .catch(() => {
        if (!cancelled) setGoals([])
      })
    return () => {
      cancelled = true
    }
  }, [scope, department, selectedYear])

  const rows = useMemo(
    () =>
      goals.map((goal) => ({
        __rowId: goal.objective,
        objective: goal.objective,
        perspective: goal.perspective,
        pillar: goal.strategic_priority,
        kpis: goal.kpi_count,
        tasks: `${goal.task_completed} / ${goal.task_total}`,
        progress: formatPercent(scope === "mine" ? goal.task_score : goal.attainment_pct),
        status: goalStatus(goal, scope),
      })),
    [goals, scope]
  )

  const goalsWithoutTasks = goals.filter((goal) => goal.task_total === 0).length
  const linkedTasks = goals.reduce((sum, goal) => sum + goal.task_total, 0)
  const completedTasks = goals.reduce((sum, goal) => sum + goal.task_completed, 0)

  const copy = SCOPE_COPY[scope]

  return (
    <PmsTablePage
      title="Goals"
      description={copy.description}
      backHref={backHref}
      backLabel={backLabel}
      icon="goals"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      summaryCards={[
        { label: "Goals", value: goals.length },
        ...(scope === "mine" ? [] : [{ label: "Goals With No Tasks", value: goalsWithoutTasks }]),
        { label: "Linked Tasks", value: linkedTasks },
        { label: "Completed Tasks", value: completedTasks },
      ]}
      tableTitle="Goals"
      tableDescription={copy.tableDescription}
      rows={rows}
      columns={[
        { key: "objective", label: "Goal" },
        { key: "perspective", label: "Perspective" },
        { key: "pillar", label: "Strategic Pillar" },
        { key: "kpis", label: "KPIs" },
        { key: "tasks", label: "Completed / Tasks" },
        { key: "progress", label: scope === "mine" ? "My Score" : "Attainment" },
        { key: "status", label: "Status" },
      ]}
      headerActions={<PlanYearSelect year={planYears.year} years={planYears.years} onChange={setSelectedYear} />}
      searchPlaceholder="Search goals..."
      filterKey="perspective"
      filterLabel="Perspective"
      filterAllLabel="All Perspectives"
    />
  )
}
