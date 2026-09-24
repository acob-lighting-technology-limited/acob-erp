"use client"

import type { ReactNode } from "react"
import { Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ColumnHelp } from "@/components/ui/data-table"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { PROJECT_PRIORITY_LABELS, normalizePriority, type ProjectPriority } from "@/lib/projects/priority"
import {
  PROJECT_HEALTH_LABELS,
  PROJECT_METRIC_HELP,
  formatTimeUsed,
  plural,
  type ProjectHealth,
  type ProjectHealthStatus,
} from "@/lib/projects/health"

export function formatCapacity(watts: number | null | undefined) {
  if (watts === null || watts === undefined) return "-"
  const kwp = watts / 1000
  return `${kwp.toLocaleString(undefined, { maximumFractionDigits: 1 })} kWp`
}

/** One colour per progress status, shared by badges, dots and bars. */
export const HEALTH_TONE: Record<ProjectHealthStatus, { badge: string; dot: string; text: string }> = {
  on_track: {
    badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  at_risk: {
    badge: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
  },
  behind_schedule: {
    badge: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400",
    dot: "bg-red-500",
    text: "text-red-700 dark:text-red-400",
  },
  completed: {
    badge: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    dot: "bg-blue-500",
    text: "text-blue-700 dark:text-blue-400",
  },
}

export function HealthBadge({ status }: { status: ProjectHealthStatus }) {
  return <Badge className={HEALTH_TONE[status].badge}>{PROJECT_HEALTH_LABELS[status]}</Badge>
}

export function PortfolioStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "active":
      return (
        <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Active</Badge>
      )
    case "on_hold":
      return <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">On hold</Badge>
    case "closed":
      return <Badge className="border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-400">Closed</Badge>
    default:
      return (
        <Badge variant="outline" className="capitalize">
          {status.replaceAll("_", " ")}
        </Badge>
      )
  }
}

const PRIORITY_BADGE: Record<ProjectPriority, string> = {
  critical: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  high: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400",
  medium: "border-border text-muted-foreground",
  low: "border-border text-muted-foreground/80",
}

/** Priority, set by hand. Only Critical and High are coloured, so they stand out. */
export function PriorityBadge({ priority }: { priority: string | null | undefined }) {
  const value = normalizePriority(priority)
  return (
    <Badge variant="outline" className={cn("font-medium", PRIORITY_BADGE[value])}>
      {PROJECT_PRIORITY_LABELS[value]}
    </Badge>
  )
}

/** The stage a manager sets by hand — deliberately neutral so it never reads as progress. */
export function ProjectStatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    planning: "Planning",
    active: "Ongoing",
    on_hold: "On hold",
    completed: "Completed",
    cancelled: "Cancelled",
  }
  return (
    <Badge variant="outline" className="text-muted-foreground font-normal">
      {labels[status] ?? status.replaceAll("_", " ")}
    </Badge>
  )
}

/** A small labelled bar: "Work done ........ 36%", with an optional note underneath. */
export function LabelledBar({
  label,
  value,
  note,
  indicatorClassName,
}: {
  label: string
  value: number | null
  note?: string
  indicatorClassName?: string
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-semibold tabular-nums">{value === null ? "—" : `${value}%`}</span>
      </div>
      <Progress value={value ?? 0} indicatorClassName={indicatorClassName} />
      {note && <p className="text-muted-foreground truncate text-[11px]">{note}</p>}
    </div>
  )
}

/** "2 of 4 plans finished", or nothing for a project without plans. */
export function plansText(health: Pick<ProjectHealth, "planCount" | "plansDoneCount">) {
  if (health.planCount === 0) return null
  return `${health.plansDoneCount} of ${plural(health.planCount, "plan")} finished`
}

/** "6 of 10 tasks done" — the short form used in table cells and cards. */
export function WorkDoneText({ health }: { health: Pick<ProjectHealth, "doneCount" | "taskCount"> }) {
  if (health.taskCount === 0) return <span className="text-muted-foreground">No tasks yet</span>
  return (
    <span>
      <span className="text-foreground font-semibold">{health.doneCount}</span> of {plural(health.taskCount, "task")}{" "}
      done
    </span>
  )
}

/** A compact work-done bar with its count underneath, for table columns. */
export function WorkDoneCell({ health }: { health: Pick<ProjectHealth, "doneCount" | "taskCount" | "workDonePct"> }) {
  if (health.taskCount === 0) return <span className="text-muted-foreground text-xs">No tasks yet</span>
  return (
    <div className="w-36 space-y-1">
      <Progress value={health.workDonePct ?? 0} />
      <p className="text-muted-foreground text-[11px]">
        <WorkDoneText health={health} />
      </p>
    </div>
  )
}

function timeNote(health: ProjectHealth) {
  if (health.daysToStart > 0) return `Starts in ${plural(health.daysToStart, "day")}`
  if (health.daysOverrun > 0) return `End date passed ${plural(health.daysOverrun, "day")} ago`
  return formatTimeUsed(health)
}

/**
 * Work done and time used as two bars on the same scale. The gap between them
 * is the whole story, so no variance number is needed to explain it.
 */
export function ProjectProgress({ health }: { health: ProjectHealth }) {
  const rows: Array<{ label: string; help: string; pct: number; text: ReactNode; bar: string }> = [
    {
      label: "Work done",
      help: PROJECT_METRIC_HELP.workDone,
      pct: health.workDonePct ?? 0,
      text: <WorkDoneText health={health} />,
      bar: "bg-primary",
    },
  ]
  if (health.timeUsedPct !== null) {
    rows.push({
      label: "Time used",
      help: PROJECT_METRIC_HELP.timeUsed,
      pct: health.timeUsedPct,
      text: timeNote(health),
      bar: health.daysOverrun > 0 ? "bg-red-400" : "bg-slate-400 dark:bg-slate-500",
    })
  }

  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[5.5rem_1fr] items-center gap-x-3 gap-y-1 sm:grid-cols-[5.5rem_1fr_10rem]"
        >
          <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-medium">
            {row.label}
            <ColumnHelp label={row.label} text={row.help} />
          </span>
          <Progress value={row.pct} indicatorClassName={row.bar} />
          <span className="text-muted-foreground col-start-2 text-xs sm:col-start-auto">{row.text}</span>
        </div>
      ))}
      {plansText(health) && <p className="text-muted-foreground text-xs">{plansText(health)}</p>}
      {health.timeUsedPct === null && (
        <p className="text-muted-foreground text-xs">No start or end date set, so time used can&apos;t be shown.</p>
      )}
    </div>
  )
}

/**
 * What is shown when a project row is expanded, on both the admin console and
 * the staff projects page.
 */
export function ProjectSummary({
  project,
  health,
}: {
  project: {
    technology_type: string | null
    capacity_w: number | null
    deployment_start_date?: string | null
    deployment_end_date?: string | null
  }
  health: ProjectHealth | undefined
}) {
  const facts = [
    { label: "Technology", value: project.technology_type || "-" },
    { label: "Capacity", value: formatCapacity(project.capacity_w) },
    {
      label: "Dates",
      value:
        project.deployment_start_date && project.deployment_end_date
          ? `${project.deployment_start_date} → ${project.deployment_end_date}`
          : "-",
    },
  ]

  return (
    <div className="bg-background space-y-4 rounded-lg border p-4">
      {health && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <HealthBadge status={health.status} />
            {health.overdueCount > 0 && (
              <span className="text-xs font-medium text-red-700 dark:text-red-400">
                {plural(health.overdueCount, "task")} past due
              </span>
            )}
            {health.averageRating !== null && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground inline-flex cursor-help items-center gap-1 text-xs">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {health.averageRating} average rating
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{PROJECT_METRIC_HELP.rating}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <ProjectProgress health={health} />
        </div>
      )}
      <dl className="grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-3">
        {facts.map((fact) => (
          <div key={fact.label} className="min-w-0 space-y-0.5">
            <dt className="text-muted-foreground text-[11px] font-medium">{fact.label}</dt>
            <dd className="truncate text-sm font-medium">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
