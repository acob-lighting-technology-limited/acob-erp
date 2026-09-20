"use client"

import { useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  BarChart3,
  Clock,
  FolderCog,
  FolderKanban,
  FolderTree,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DataTablePage, type DataTableTab } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { EmptyState } from "@/components/ui/patterns/empty-state"
import { PortfolioStatusBadge } from "@/components/projects/project-summary"
import { ProjectsOverview, type OverviewProject } from "@/components/projects/projects-overview"
import { ProjectCharts } from "@/components/projects/project-charts"
import { ProjectDialogs } from "@/app/admin/projects/_components/project-dialogs"
import { PortfolioDialog } from "@/app/admin/portfolios/_components/portfolio-dialog"
import { PortfolioProjectsDialog } from "@/app/admin/portfolios/_components/portfolio-projects-dialog"
import type { Portfolio, ProjectHealthRow } from "@/app/admin/portfolios/_components/portfolios-content"
import { apiFetch } from "@/lib/api-client"
import type { PortfolioHealth } from "@/lib/projects/health"
import { portfoliosListHref, projectHref } from "@/lib/projects/links"
import { PROJECTS_QUERY_KEY, fetchProjectRecords, projectHealth, toChartProject } from "@/lib/projects/records"
import { toLocalISODate } from "@/lib/utils/date"

type ManagerOption = {
  id: string
  first_name: string
  last_name: string
  full_name?: string | null
  department: string
}

/** One portfolio's own page: its projects ranked by what needs attention, and its charts. */
export function PortfolioDetail({
  portfolioId,
  isAdmin,
  profiles = [],
}: {
  portfolioId: string
  isAdmin: boolean
  profiles?: ManagerOption[]
}) {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const activeTab = searchParams.get("tab") === "charts" ? "charts" : "projects"
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isManageOpen, setIsManageOpen] = useState(false)
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false)

  // Same key and shape as the portfolios list, so the two pages share a cache.
  const portfoliosQuery = useQuery<{
    data: Portfolio[]
    unassigned: { projects: ProjectHealthRow[]; rollup: PortfolioHealth }
  }>({
    queryKey: ["portfolios"],
    queryFn: async () => {
      const res = await apiFetch("/api/portfolios", { cache: "no-store" })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to load portfolios")
      return payload
    },
  })
  const projectsQuery = useQuery({ queryKey: PROJECTS_QUERY_KEY, queryFn: fetchProjectRecords })

  const portfolios = useMemo(() => portfoliosQuery.data?.data ?? [], [portfoliosQuery.data])
  const portfolio = portfolios.find((p) => p.id === portfolioId) ?? null

  const projects = useMemo(
    () => (projectsQuery.data ?? []).filter((project) => project.portfolio_id === portfolioId),
    [projectsQuery.data, portfolioId]
  )
  const today = toLocalISODate()
  const overviewItems = useMemo<OverviewProject[]>(
    () =>
      projects.map((project) => ({
        id: project.id,
        project_name: project.project_name,
        portfolioName: project.portfolio?.name ?? null,
        priority: project.priority ?? null,
        health: projectHealth(project, today),
      })),
    [projects, today]
  )
  const chartProjects = useMemo(() => projects.map(toChartProject), [projects])

  const stats = useMemo(() => {
    let needAttention = 0
    let pastDue = 0
    let plans = 0
    let plansDone = 0
    let done = 0
    for (const { health } of overviewItems) {
      if (health.status === "completed") done++
      if (health.status === "at_risk" || health.status === "behind_schedule") needAttention++
      pastDue += health.overdueCount
      plans += health.planCount
      plansDone += health.plansDoneCount
    }
    return { needAttention, pastDue, plans, plansDone, done }
  }, [overviewItems])

  const tabs = useMemo<DataTableTab[]>(
    () => [
      { key: "projects", label: "Projects", icon: FolderKanban },
      { key: "charts", label: "Charts", icon: BarChart3 },
    ],
    []
  )

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["portfolios"] })
    void queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY })
  }

  const backLink = { href: portfoliosListHref(isAdmin), label: "Back to Portfolios" }
  const isLoading = portfoliosQuery.isLoading || projectsQuery.isLoading
  const error = portfoliosQuery.error || projectsQuery.error

  if (isLoading || error || !portfolio) {
    return (
      <DataTablePage title={portfolio?.name ?? "Portfolio"} icon={Layers} backLink={backLink}>
        {isLoading ? (
          <div className="bg-muted/40 h-64 animate-pulse rounded-xl" />
        ) : error ? (
          <EmptyState
            title="Couldn't load this portfolio"
            description={error instanceof Error ? error.message : "Something went wrong."}
            action={
              <Button variant="outline" size="sm" onClick={refresh}>
                Try again
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="Portfolio not found"
            description="It may have been deleted, or you may not have access to it."
          />
        )}
      </DataTablePage>
    )
  }

  return (
    <DataTablePage
      title={portfolio.code ? `${portfolio.code} — ${portfolio.name}` : portfolio.name}
      description={portfolio.description || undefined}
      icon={Layers}
      backLink={backLink}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tab) => router.replace(tab === "projects" ? pathname : `${pathname}?tab=${tab}`, { scroll: false })}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <PortfolioStatusBadge status={portfolio.status} />
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsManageOpen(true)}>
                <FolderCog className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Manage Projects</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
                <Pencil className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
              <Button size="sm" onClick={() => setIsAddProjectOpen(true)}>
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">New Project</span>
              </Button>
            </>
          )}
        </div>
      }
      stats={
        <StatGrid>
          <StatCard
            variant="compact"
            title="Projects"
            value={`${stats.done} of ${projects.length} done`}
            icon={FolderKanban}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            variant="compact"
            title="Need attention"
            value={stats.needAttention}
            tooltip="Projects that are Slipping or Behind"
            icon={AlertTriangle}
            iconBgColor={stats.needAttention > 0 ? "bg-amber-500/10" : "bg-slate-500/10"}
            iconColor={stats.needAttention > 0 ? "text-amber-500" : "text-slate-500"}
          />
          <StatCard
            variant="compact"
            title="Tasks past due"
            value={stats.pastDue}
            icon={Clock}
            iconBgColor={stats.pastDue > 0 ? "bg-red-500/10" : "bg-slate-500/10"}
            iconColor={stats.pastDue > 0 ? "text-red-500" : "text-slate-500"}
          />
          <StatCard
            variant="compact"
            title="Plans finished"
            value={stats.plans === 0 ? "No plans" : `${stats.plansDone} of ${stats.plans}`}
            icon={FolderTree}
            iconBgColor="bg-violet-500/10"
            iconColor="text-violet-500"
          />
        </StatGrid>
      }
    >
      {activeTab === "charts" ? (
        <ProjectCharts projects={chartProjects} filterBy="project" />
      ) : (
        <ProjectsOverview projects={overviewItems} hrefFor={(project) => projectHref(project.id, isAdmin)} />
      )}

      {isAdmin && (
        <>
          <PortfolioDialog
            open={isEditOpen}
            onOpenChange={setIsEditOpen}
            portfolio={portfolio}
            onSuccess={() => {
              toast.success("Portfolio updated")
              setIsEditOpen(false)
              refresh()
            }}
          />
          <PortfolioProjectsDialog
            open={isManageOpen}
            onOpenChange={setIsManageOpen}
            portfolio={portfolio}
            portfolios={portfolios}
            unassignedProjects={portfoliosQuery.data?.unassigned?.projects ?? []}
            onChanged={refresh}
            onCreateProject={() => {
              setIsManageOpen(false)
              setIsAddProjectOpen(true)
            }}
          />
          <ProjectDialogs
            profiles={profiles}
            isAddOpen={isAddProjectOpen}
            setIsAddOpen={setIsAddProjectOpen}
            isEditOpen={false}
            setIsEditOpen={() => {}}
            selectedProject={null}
            defaultPortfolioId={portfolio.id}
            onSuccess={refresh}
          />
        </>
      )}
    </DataTablePage>
  )
}
