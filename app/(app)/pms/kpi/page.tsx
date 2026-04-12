import { createClient } from "@/lib/supabase/server"
import { PmsTablePage } from "@/app/admin/hr/pms/_components/pms-table-page"
import { getCurrentUserPmsData } from "../_lib"

function formatPercent(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value}%` : "-"
}

export default async function PmsKpiPage() {
  const { score, goalSummary } = await getCurrentUserPmsData()
  const supabase = await createClient()
  const { data: latestCycle } = await supabase
    .from("review_cycles")
    .select("name")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle<{ name: string }>()

  const rows = score.breakdown.goals.map((goal) => ({
    cycle: latestCycle?.name || "Current",
    goal: goal.title,
    goal_progress_pct: `${goal.goal_progress_pct}%`,
    effective_kpi_pct: `${goal.effective_kpi_pct}%`,
    linked_tasks: `${goal.linked_tasks_completed}/${goal.linked_tasks_total}`,
    weight: goal.custom_weight_pct !== null ? `${goal.custom_weight_pct}%` : goal.priority_weight,
  }))

  return (
    <PmsTablePage
      title="PMS KPI"
      description={`Current KPI: ${formatPercent(score.kpi_score)}. Approved goals: ${goalSummary.approved}. Completed goals: ${goalSummary.completed}.`}
      backHref="/pms"
      backLabel="Back to PMS"
      icon="kpi"
      summaryCards={[
        { label: "Current KPI", value: formatPercent(score.kpi_score) },
        { label: "Approved Goals", value: goalSummary.approved },
        { label: "Completed Goals", value: goalSummary.completed },
      ]}
      tableTitle="KPI Goal Breakdown"
      tableDescription="Approved department goals contributing to your current KPI score."
      rows={rows}
      columns={[
        { key: "cycle", label: "Cycle" },
        { key: "goal", label: "Goal" },
        { key: "goal_progress_pct", label: "Goal Progress" },
        { key: "effective_kpi_pct", label: "Effective KPI" },
        { key: "linked_tasks", label: "Linked Tasks" },
        { key: "weight", label: "Weight" },
      ]}
      searchPlaceholder="Search goal or KPI row..."
      filterKey="cycle"
      filterLabel="Cycle"
      filterAllLabel="All Cycles"
    />
  )
}
