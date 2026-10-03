import { Award, Brain, Clock3, FileText, RefreshCw, Settings, ShieldCheck, Target } from "lucide-react"
import { PageHeader, PageWrapper, Section, ModuleHubGrid } from "@/components/layout"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { getAdminPmsData } from "./_lib"
import { getRequestScope } from "@/lib/admin/api-scope"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { getCbtSettings, canAccessCbt } from "@/lib/cbt-config"
import { CycleSelector } from "@/app/(app)/pms/_components/cycle-selector"
import { formatScore } from "@/lib/format"

const adminPmsLinks = [
  {
    title: "KPI",
    href: "/admin/pms/kpi",
    icon: Target,
    description: "View department KPI drivers and current KPI scores.",
    color: "bg-blue-500/10 text-info-foreground border-blue-500/20",
    fill: "bg-blue-500",
    hoverBorder: "hover:border-blue-500/60 dark:hover:border-blue-400/60",
    hoverText: "group-hover:text-blue-500",
    subLabel: "KPI drivers & scores",
  },
  {
    title: "Attendance",
    href: "/admin/pms/attendance",
    icon: Clock3,
    description: "Monitor attendance compliance contributing to PMS.",
    color: "bg-amber-500/10 text-warning-foreground border-amber-500/20",
    fill: "bg-amber-500",
    hoverBorder: "hover:border-amber-500/60 dark:hover:border-amber-400/60",
    hoverText: "group-hover:text-amber-500",
    subLabel: "Clocking compliance in PMS",
  },
  {
    title: "CBT",
    href: "/admin/pms/cbt",
    icon: Brain,
    description: "Track learning capability scores across departments.",
    color: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
    fill: "bg-violet-500",
    hoverBorder: "hover:border-violet-500/60 dark:hover:border-violet-400/60",
    hoverText: "group-hover:text-violet-500",
    subLabel: "Learning scores",
  },
  {
    title: "Behaviour",
    href: "/admin/pms/behaviour",
    icon: ShieldCheck,
    description: "Watch behaviour and leadership scoring in scope.",
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    fill: "bg-purple-500",
    hoverBorder: "hover:border-purple-500/60 dark:hover:border-purple-400/60",
    hoverText: "group-hover:text-purple-500",
    subLabel: "Feedback & leadership blend",
  },
  {
    title: "Performance Reviews",
    href: "/admin/pms/reviews",
    icon: FileText,
    description: "Create and manage reviews from the PMS area.",
    color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    fill: "bg-indigo-500",
    hoverBorder: "hover:border-indigo-500/60 dark:hover:border-indigo-400/60",
    hoverText: "group-hover:text-indigo-500",
    subLabel: "Review forms & acknowledgements",
  },
  {
    title: "Review Cycles",
    href: "/admin/pms/cycles",
    icon: RefreshCw,
    description: "Create and manage performance review cycles.",
    color: "bg-blue-500/10 text-info-foreground border-blue-500/20",
    fill: "bg-blue-500",
    hoverBorder: "hover:border-blue-500/60 dark:hover:border-blue-400/60",
    hoverText: "group-hover:text-blue-500",
    subLabel: "Quarterly & annual cycles",
  },
  {
    title: "Analytics",
    href: "/admin/pms/analytics",
    icon: Settings,
    description: "Performance distribution, trends, and calibration data.",
    color: "bg-orange-500/10 text-warning-foreground border-orange-500/20",
    fill: "bg-orange-500",
    hoverBorder: "hover:border-orange-500/60 dark:hover:border-orange-400/60",
    hoverText: "group-hover:text-orange-500",
    subLabel: "Calibration & distribution",
  },
  {
    title: "Competencies",
    href: "/admin/pms/competencies",
    icon: ShieldCheck,
    description: "Manage behaviour competency keys used in performance reviews.",
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    fill: "bg-purple-500",
    hoverBorder: "hover:border-purple-500/60 dark:hover:border-purple-400/60",
    hoverText: "group-hover:text-purple-500",
    subLabel: "Scoring rubric keys",
  },
]

export async function AdminPmsPage({ basePath, cycleId }: { basePath?: string; cycleId?: string } = {}) {
  const base = basePath ?? "/admin"
  const supabase = await createClient()
  const db = getServiceRoleClientOrFallback(supabase)
  const [{ summary, cycles, activeCycleId }, scope, cbtSettings] = await Promise.all([
    getAdminPmsData(cycleId),
    getRequestScope(),
    getCbtSettings(db),
  ])
  const canAccessCbtCard = canAccessCbt(scope, cbtSettings)
  const visibleLinks = adminPmsLinks
    .filter((item) => item.href !== "/admin/pms/cbt" || canAccessCbtCard)
    .map((item) => ({ ...item, href: item.href.replace("/admin", base) }))

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="PMS"
        description="Monitor live KPI, goals, attendance, CBT, behaviour, and reviews from one HR performance area."
        icon={Award}
        backLink={{ href: `${base}/hr`, label: "Back to HR" }}
        actions={<CycleSelector cycles={cycles} activeCycleId={activeCycleId} />}
      />

      <StatGrid>
        <StatCard
          variant="compact"
          title="Avg PMS"
          value={formatScore(summary.overallPms)}
          icon={Award}
          description="Average individual PMS"
        />
        <StatCard
          variant="compact"
          title="Avg KPI"
          value={formatScore(summary.overallKpi)}
          icon={Target}
          description="Average individual KPI"
        />
        <StatCard
          variant="compact"
          title="Avg CBT"
          value={formatScore(summary.cbt)}
          icon={Brain}
          description="Average learning capability score"
        />
        <StatCard
          variant="compact"
          title="Avg Attendance"
          value={formatScore(summary.attendance)}
          icon={Clock3}
          description="Attendance compliance"
        />
      </StatGrid>

      <Section
        title="PMS Areas"
        description="Open each route from here as the new home for performance visibility and review actions."
      >
        <ModuleHubGrid
          cards={visibleLinks.map((c) => ({
            title: c.title,
            description: c.description,
            href: c.href,
            icon: c.icon,
            footer: c.subLabel,
            color: c.color,
            fill: c.fill,
            hoverBorder: c.hoverBorder,
            hoverText: c.hoverText,
          }))}
        />
      </Section>
    </PageWrapper>
  )
}
