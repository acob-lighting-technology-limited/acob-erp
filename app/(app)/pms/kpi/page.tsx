import { Target } from "lucide-react"
import { PageHeader, PageWrapper, Section } from "@/components/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"
import { getCurrentUserPmsData } from "../_lib"

export default async function PmsKpiPage() {
  const { score, goalSummary } = await getCurrentUserPmsData()

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="PMS KPI"
        description="See how approved goals and linked task completion are shaping your KPI score."
        icon={Target}
        backLink={{ href: "/pms", label: "Back to PMS" }}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard title="Current KPI" value={`${score.kpi_score}%`} icon={Target} />
        <StatCard title="Approved Goals" value={goalSummary.approved} description="Goals already cleared for scoring" />
        <StatCard title="Completed Goals" value={goalSummary.completed} description="Goal records marked completed" />
      </div>

      <Section title="Goal Breakdown" description="Each approved goal contributes to the KPI score below.">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {score.breakdown.goals.length > 0 ? (
            score.breakdown.goals.map((goal) => (
              <Card key={goal.goal_id}>
                <CardHeader>
                  <CardTitle className="text-base">{goal.title}</CardTitle>
                  <CardDescription>
                    Priority: {goal.priority}{" "}
                    {goal.custom_weight_pct !== null ? `| Custom weight: ${goal.custom_weight_pct}%` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Goal progress</p>
                    <p className="text-xl font-semibold">{goal.goal_progress_pct}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Effective KPI</p>
                    <p className="text-xl font-semibold">{goal.effective_kpi_pct}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Linked tasks</p>
                    <p className="font-medium">
                      {goal.linked_tasks_completed}/{goal.linked_tasks_total}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Weight</p>
                    <p className="font-medium">{goal.priority_weight}</p>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="text-muted-foreground pt-6 text-sm">
                No approved goals are contributing to your KPI yet.
              </CardContent>
            </Card>
          )}
        </div>
      </Section>
    </PageWrapper>
  )
}
