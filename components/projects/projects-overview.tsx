"use client"

import Link from "next/link"
import { ChevronRight, Clock, FolderKanban } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { HEALTH_TONE, HealthBadge, LabelledBar } from "@/components/projects/project-summary"
import { cn } from "@/lib/utils"
import { plural, type ProjectHealth, type ProjectHealthStatus } from "@/lib/projects/health"

export type OverviewProject = {
  id: string
  project_name: string
  portfolioName: string | null
  health: ProjectHealth
}

/** Worst first, so the most urgent project is always at the top of the list. */
const URGENCY: Record<ProjectHealthStatus, number> = { behind_schedule: 0, at_risk: 1, on_track: 2, completed: 3 }

/** How far work trails the calendar; projects without dates sort as if level. */
function gap(health: ProjectHealth) {
  if (health.timeUsedPct === null || health.workDonePct === null) return 0
  return health.timeUsedPct - health.workDonePct
}

/**
 * Every project, most in need of attention first: Behind, then Slipping, then
 * On time, then Done — and within each, the widest gap and most past-due tasks.
 */
export function rankByAttention(projects: OverviewProject[]) {
  return [...projects].sort(
    (a, b) =>
      URGENCY[a.health.status] - URGENCY[b.health.status] ||
      gap(b.health) - gap(a.health) ||
      b.health.overdueCount - a.health.overdueCount ||
      a.project_name.localeCompare(b.project_name)
  )
}

export function ProjectsOverview({
  projects,
  hrefFor,
}: {
  projects: OverviewProject[]
  /** Where a project row links to — usually the projects table filtered to it. */
  hrefFor: (project: OverviewProject) => string
}) {
  const ranked = rankByAttention(projects)
  const needAttention = ranked.filter(
    (p) => p.health.status === "at_risk" || p.health.status === "behind_schedule"
  ).length

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b py-4">
        <div className="space-y-1">
          <CardTitle className="text-base">All projects</CardTitle>
          <CardDescription>Ranked by what needs attention most: behind first, done last.</CardDescription>
        </div>
        {needAttention > 0 && (
          <Badge className="border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400">
            {needAttention} need attention
          </Badge>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {ranked.length === 0 ? (
          <div className="text-muted-foreground flex items-center gap-2 px-6 py-5 text-sm">
            <FolderKanban className="h-4 w-4 shrink-0" />
            No projects yet.
          </div>
        ) : (
          <ul className="divide-y">
            {ranked.map((project) => {
              const { health } = project
              return (
                <li key={project.id}>
                  <Link
                    href={hrefFor(project)}
                    className="group hover:bg-muted/40 relative grid grid-cols-3 items-center gap-x-6 gap-y-3 px-6 py-4 transition-colors md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_6rem]"
                  >
                    <span
                      aria-hidden
                      className={cn("absolute inset-y-3 left-0 w-1 rounded-r-full", HEALTH_TONE[health.status].dot)}
                    />
                    <div className="col-span-3 min-w-0 space-y-1 md:col-span-1">
                      <p className="truncate text-sm font-semibold" title={project.project_name}>
                        {project.project_name}
                      </p>
                      <div className="flex items-center gap-2">
                        <HealthBadge status={health.status} />
                        <span className="text-muted-foreground truncate text-xs">
                          {project.portfolioName ?? "Not in a portfolio"}
                        </span>
                      </div>
                    </div>
                    {health.planCount > 0 ? (
                      <LabelledBar
                        label="Plans"
                        value={Math.round((health.plansDoneCount / health.planCount) * 100)}
                        note={`${health.plansDoneCount} of ${plural(health.planCount, "plan")}`}
                      />
                    ) : (
                      <p className="text-muted-foreground text-xs italic">No plans yet</p>
                    )}
                    {health.taskCount > 0 ? (
                      <LabelledBar
                        label="Work done"
                        value={health.workDonePct}
                        note={`${health.doneCount} of ${plural(health.taskCount, "task")}`}
                      />
                    ) : (
                      <p className="text-muted-foreground text-xs italic">No tasks yet</p>
                    )}
                    {health.timeUsedPct === null ? (
                      <p className="text-muted-foreground text-xs italic">No dates set</p>
                    ) : (
                      <LabelledBar
                        label="Time used"
                        value={health.timeUsedPct}
                        indicatorClassName={health.daysOverrun > 0 ? "bg-red-400" : "bg-slate-400 dark:bg-slate-500"}
                      />
                    )}
                    <div className="col-span-3 flex items-center justify-between gap-2 md:col-span-1 md:justify-end">
                      {health.overdueCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400">
                          <Clock className="h-3.5 w-3.5" />
                          {health.overdueCount} past due
                        </span>
                      ) : (
                        <span />
                      )}
                      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
