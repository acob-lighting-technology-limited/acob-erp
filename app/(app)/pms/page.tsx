import { Award, Brain, Clock3, ShieldCheck, Target, TrendingUp } from "lucide-react"
import { PageHeader, PageWrapper, Section, ModuleHubGrid } from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { getCurrentUserPmsData } from "./_lib"
import { CycleSelector } from "./_components/cycle-selector"
import { formatScore } from "@/lib/format"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

export default async function PmsPage({ searchParams }: { searchParams: Promise<{ cycle_id?: string }> }) {
  const { cycle_id } = await searchParams
  const { profile, score, cycles, activeCycleId, attendance, latestReview } = await getCurrentUserPmsData(cycle_id)

  const pmsAreaCards = [
    {
      title: "KPI",
      description: "See your scored work, KPI score, and the company goals your tasks serve.",
      href: "/pms/kpi",
      icon: Target,
      score: formatScore(score.kpi_score),
      scoreSub: "Weighted task score",
      color: "bg-blue-500/10 text-info-foreground border-blue-500/20",
      fill: "bg-blue-500",
      hoverBorder: "hover:border-blue-500/60 dark:hover:border-blue-400/60",
      hoverText: "group-hover:text-blue-500",
    },
    {
      title: "Attendance",
      description: "Watch your attendance score and recent clocking activity.",
      href: "/pms/attendance",
      icon: Clock3,
      score: formatScore(score.attendance_score),
      scoreSub: `${attendance.presentDays}/${attendance.trackedDays || 0} days positive`,
      color: "bg-amber-500/10 text-warning-foreground border-amber-500/20",
      fill: "bg-amber-500",
      hoverBorder: "hover:border-amber-500/60 dark:hover:border-amber-400/60",
      hoverText: "group-hover:text-amber-500",
    },
    {
      title: "CBT",
      description: "View your CBT scores by quarter from PMS.",
      href: "/pms/cbt",
      icon: Brain,
      score: formatScore(score.cbt_score),
      scoreSub: "Learning score in PMS",
      color: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
      fill: "bg-violet-500",
      hoverBorder: "hover:border-violet-500/60 dark:hover:border-violet-400/60",
      hoverText: "group-hover:text-violet-500",
    },
    {
      title: "Behaviour",
      description: "View behaviour scoring from current review and feedback signals.",
      href: "/pms/behaviour",
      icon: ShieldCheck,
      score: formatScore(score.behaviour_score),
      scoreSub: "Manager & peer feedback",
      color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      fill: "bg-purple-500",
      hoverBorder: "hover:border-purple-500/60 dark:hover:border-purple-400/60",
      hoverText: "group-hover:text-purple-500",
    },
    {
      title: "Performance Reviews",
      description: "Open your completed reviews and acknowledgements.",
      href: "/pms/reviews",
      icon: TrendingUp,
      score:
        latestReview?.final_score !== null && latestReview?.final_score !== undefined
          ? `${latestReview.final_score}%`
          : latestReview?.status || "Draft",
      scoreSub: latestReview ? `Status: ${latestReview.status || "draft"}` : "No review yet",
      color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
      fill: "bg-indigo-500",
      hoverBorder: "hover:border-indigo-500/60 dark:hover:border-indigo-400/60",
      hoverText: "group-hover:text-indigo-500",
    },
  ]

  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <PageWrapper maxWidth="full" background="gradient">
        <PageHeader
          title="PMS"
          description={`Track your live performance scores across KPI, goals, attendance, CBT, behaviour, and reviews${profile?.department ? ` in ${profile.department}` : ""}.`}
          icon={Award}
          backLink={{ href: "/profile", label: "Back to Dashboard" }}
          actions={<CycleSelector cycles={cycles} activeCycleId={activeCycleId} />}
        />

        <StatGrid>
          <StatCard
            variant="compact"
            title="Overall PMS"
            value={formatScore(score.final_score)}
            icon={Award}
            description="Live overall score"
          />
          <StatCard
            variant="compact"
            title="KPI"
            value={formatScore(score.kpi_score)}
            icon={Target}
            description="Weighted task score"
          />
          <StatCard
            variant="compact"
            title="Attendance"
            value={formatScore(score.attendance_score)}
            icon={Clock3}
            description={`${attendance.presentDays}/${attendance.trackedDays || 0} recent days positive`}
          />
          <StatCard
            variant="compact"
            title="CBT"
            value={formatScore(score.cbt_score)}
            icon={Brain}
            description="Learning score in PMS"
          />
          <StatCard
            variant="compact"
            title="Behaviour"
            value={formatScore(score.behaviour_score)}
            icon={ShieldCheck}
            description="Manager and peer feedback blend"
          />
        </StatGrid>

        <Section title="Performance Areas" description="Open each PMS area to see the live score details behind it.">
          <ModuleHubGrid
            cards={pmsAreaCards.map((c) => ({
              title: c.title,
              description: c.description,
              href: c.href,
              icon: c.icon,
              tag: c.score,
              footer: c.scoreSub,
              color: c.color,
              fill: c.fill,
              hoverBorder: c.hoverBorder,
              hoverText: c.hoverText,
            }))}
          />
        </Section>

        <Section
          title="How This Updates"
          description="These scores refresh from the same ERP records used for goals, attendance, and review workflows."
        >
          <Card>
            <CardContent className="space-y-3 pt-6 text-sm">
              <p>
                KPI is calculated from approved goals and linked task completion. Attendance reflects your tracked
                workdays, while behaviour comes from review feedback already in the ERP.
              </p>
              <p>
                CBT scores appear here inside PMS, while the live objective test itself runs separately on the
                standalone /cbt page.
              </p>
            </CardContent>
          </Card>
        </Section>
      </PageWrapper>
    </TablePageLayoutProvider>
  )
}
