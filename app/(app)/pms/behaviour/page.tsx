import { ShieldCheck } from "lucide-react"
import { PageHeader, PageWrapper, Section } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"
import { getCurrentUserPmsData } from "../_lib"

export default async function PmsBehaviourPage() {
  const { score } = await getCurrentUserPmsData()

  return (
    <PageWrapper maxWidth="content" background="gradient">
      <PageHeader
        title="PMS Behaviour"
        description="See the behaviour component contributing to your overall PMS."
        icon={ShieldCheck}
        backLink={{ href: "/pms", label: "Back to PMS" }}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard title="Behaviour Score" value={`${score.behaviour_score}%`} icon={ShieldCheck} />
        <StatCard
          title="Manager Score"
          value={`${score.manager_behaviour_score}%`}
          description="Latest recorded manager behaviour score"
        />
        <StatCard
          title="Peer Feedback"
          value={score.peer_feedback_count}
          description={`Peer average: ${score.peer_behaviour_score}%`}
        />
      </div>

      <Section title="How It Is Calculated">
        <Card>
          <CardHeader>
            <CardTitle>Behaviour Blend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Where peer feedback exists, PMS blends manager behaviour scoring with peer submissions. If no peer
              feedback exists yet, the manager score carries the behaviour section.
            </p>
            <p>
              That keeps behaviour visible in real time while still letting new feedback raise or lower the score later.
            </p>
          </CardContent>
        </Card>
      </Section>
    </PageWrapper>
  )
}
