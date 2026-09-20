"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  FolderKanban,
  FolderTree,
  Layers,
  MapPin,
  Pencil,
  RefreshCw,
  Star,
  Wrench,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DataTablePage, type DataTableTab } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { EmptyState } from "@/components/ui/patterns/empty-state"
import {
  HealthBadge,
  PriorityBadge,
  ProjectProgress,
  ProjectStatusBadge,
  formatCapacity,
} from "@/components/projects/project-summary"
import { ProjectCharts } from "@/components/projects/project-charts"
import { ProjectDialogs } from "@/app/admin/projects/_components/project-dialogs"
import { ProjectPlanBoard } from "@/app/admin/projects/_components/project-plan-board"
import type { employee } from "@/app/admin/tasks/management/admin-tasks-content"
import { PROJECT_METRIC_HELP, formatTimeUsed, plural } from "@/lib/projects/health"
import { portfolioHref, projectsListHref } from "@/lib/projects/links"
import {
  PROJECTS_QUERY_KEY,
  fetchProjectRecords,
  managerName,
  projectHealth,
  toChartProject,
} from "@/lib/projects/records"
import { toLocalISODate } from "@/lib/utils/date"

/**
 * One project's own page: what it is, how it is going, and its plans — the
 * one place plans are managed.
 */
export function ProjectDetail({
  projectId,
  isAdmin,
  profiles = [],
}: {
  projectId: string
  isAdmin: boolean
  profiles?: employee[]
}) {
  const queryClient = useQueryClient()
  const [isEditOpen, setIsEditOpen] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const activeTab = searchParams.get("tab") === "charts" ? "charts" : "plans"

  const {
    data: projects = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: fetchProjectRecords,
  })

  const project = useMemo(() => projects.find((p) => p.id === projectId) ?? null, [projects, projectId])
  const health = useMemo(() => (project ? projectHealth(project, toLocalISODate()) : null), [project])
  const chartProjects = useMemo(() => (project ? [toChartProject(project)] : []), [project])

  const tabs = useMemo<DataTableTab[]>(
    () => [
      { key: "plans", label: "Plans", icon: FolderTree },
      { key: "charts", label: "Charts", icon: BarChart3 },
    ],
    []
  )

  const backLink = { href: projectsListHref(isAdmin), label: "Back to Projects" }

  if (isLoading || error || !project || !health) {
    return (
      <DataTablePage title={project?.project_name ?? "Project"} icon={FolderKanban} backLink={backLink}>
        {isLoading ? (
          <div className="bg-muted/40 h-64 animate-pulse rounded-xl" />
        ) : error ? (
          <EmptyState
            title="Couldn't load this project"
            description={error instanceof Error ? error.message : "Something went wrong."}
            action={
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="Project not found"
            description="It may have been deleted, or you may not have access to it."
          />
        )}
      </DataTablePage>
    )
  }

  const facts = [
    {
      icon: Layers,
      label: "Portfolio",
      value: project.portfolio ? (
        <Link href={portfolioHref(project.portfolio.id, isAdmin)} className="text-primary hover:underline">
          {project.portfolio.name}
        </Link>
      ) : (
        "Not in a portfolio"
      ),
    },
    { icon: Briefcase, label: "Project manager", value: managerName(project) },
    { icon: MapPin, label: "Location", value: project.location || "-" },
    {
      icon: Calendar,
      label: "Dates",
      value:
        project.deployment_start_date && project.deployment_end_date
          ? `${project.deployment_start_date} → ${project.deployment_end_date}`
          : "-",
    },
    { icon: Wrench, label: "Technology", value: project.technology_type || "-" },
    { icon: Zap, label: "Capacity", value: formatCapacity(project.capacity_w) },
  ]

  return (
    <DataTablePage
      title={project.project_name}
      description={project.description || undefined}
      icon={FolderKanban}
      backLink={backLink}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tab) => router.replace(tab === "plans" ? pathname : `${pathname}?tab=${tab}`, { scroll: false })}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY })
              void queryClient.invalidateQueries({ queryKey: ["project-plans", project.id] })
              void queryClient.invalidateQueries({ queryKey: ["project-tasks", project.id] })
            }}
          >
            <RefreshCw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          {isAdmin && (
            <Button size="sm" onClick={() => setIsEditOpen(true)}>
              <Pencil className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Edit Project</span>
              <span className="sm:hidden">Edit</span>
            </Button>
          )}
        </div>
      }
      stats={
        <StatGrid>
          <StatCard
            variant="compact"
            title="Work done"
            value={health.taskCount === 0 ? "No tasks" : `${health.doneCount} of ${health.taskCount}`}
            tooltip={PROJECT_METRIC_HELP.workDone}
            icon={CheckCircle2}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            variant="compact"
            title="Time used"
            value={formatTimeUsed(health) ?? "No dates"}
            tooltip={PROJECT_METRIC_HELP.timeUsed}
            icon={Calendar}
            iconBgColor="bg-slate-500/10"
            iconColor="text-slate-500"
          />
          <StatCard
            variant="compact"
            title="Tasks past due"
            value={health.overdueCount}
            tooltip={PROJECT_METRIC_HELP.pastDue}
            icon={Clock}
            iconBgColor={health.overdueCount > 0 ? "bg-red-500/10" : "bg-slate-500/10"}
            iconColor={health.overdueCount > 0 ? "text-red-500" : "text-slate-500"}
          />
          <StatCard
            variant="compact"
            title="Plans finished"
            value={health.planCount === 0 ? "No plans" : `${health.plansDoneCount} of ${health.planCount}`}
            icon={FolderTree}
            iconBgColor="bg-violet-500/10"
            iconColor="text-violet-500"
          />
        </StatGrid>
      }
    >
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-5 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <HealthBadge status={health.status} />
              <PriorityBadge priority={project.priority} />
              <ProjectStatusBadge status={project.status} />
              {health.overdueCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {plural(health.overdueCount, "task")} past due
                </span>
              )}
              {health.averageRating !== null && (
                <span
                  className="text-muted-foreground inline-flex items-center gap-1 text-xs"
                  title={PROJECT_METRIC_HELP.rating}
                >
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {health.averageRating} average rating
                </span>
              )}
            </div>
            <ProjectProgress health={health} />
            <dl className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
              {facts.map((fact) => (
                <div key={fact.label} className="flex min-w-0 items-start gap-2.5">
                  <fact.icon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <dt className="text-muted-foreground text-[11px] font-medium">{fact.label}</dt>
                    <dd className="truncate text-sm font-medium">{fact.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {activeTab === "charts" ? (
          <ProjectCharts projects={chartProjects} filterBy="none" />
        ) : (
          <Card>
            <CardContent className="p-5">
              <ProjectPlanBoard project={project} profiles={profiles} readOnly={!isAdmin} />
            </CardContent>
          </Card>
        )}
      </div>

      {isAdmin && (
        <ProjectDialogs
          profiles={profiles}
          isAddOpen={false}
          setIsAddOpen={() => {}}
          isEditOpen={isEditOpen}
          setIsEditOpen={setIsEditOpen}
          selectedProject={project}
          onSuccess={() => void queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY })}
        />
      )}
    </DataTablePage>
  )
}
