"use client"

import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { ColumnHelp } from "@/components/ui/data-table"
import { PROJECT_METRIC_HELP, type ProjectHealth } from "@/lib/projects/health"

export function formatCapacity(watts: number | null | undefined) {
  if (watts === null || watts === undefined) return "-"
  const kwp = watts / 1000
  return `${kwp.toLocaleString(undefined, { maximumFractionDigits: 1 })} kWp`
}

export function formatVariance(variancePct: number | null | undefined) {
  if (variancePct === null || variancePct === undefined) return null
  return `${variancePct > 0 ? "+" : ""}${variancePct}%`
}

export function HealthBadge({ status }: { status: string }) {
  switch (status) {
    case "on_track":
      return (
        <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          On Track
        </Badge>
      )
    case "at_risk":
      return <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">At Risk</Badge>
    case "behind_schedule":
      return <Badge className="border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400">Behind Schedule</Badge>
    case "completed":
      return <Badge className="border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400">Completed</Badge>
    default:
      return (
        <Badge variant="outline" className="capitalize">
          {status.replaceAll("_", " ")}
        </Badge>
      )
  }
}

export function PortfolioStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "active":
      return (
        <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Active</Badge>
      )
    case "on_hold":
      return <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">On Hold</Badge>
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

export function ProjectStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "active":
      return (
        <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          Ongoing
        </Badge>
      )
    case "completed":
      return <Badge className="border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400">Completed</Badge>
    case "planning":
      return <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">Planning</Badge>
    case "on_hold":
      return <Badge className="border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400">On Hold</Badge>
    case "cancelled":
      return <Badge className="border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-400">Cancelled</Badge>
    default:
      return (
        <Badge variant="outline" className="capitalize">
          {status.replaceAll("_", " ")}
        </Badge>
      )
  }
}

export interface ProjectStatusBarProps {
  completed?: number
  inProgress?: number
  pending?: number
  overdue?: number
  total?: number
  className?: string
  showLabels?: boolean
}

export function ProjectStatusBar({
  completed = 0,
  inProgress = 0,
  pending = 0,
  overdue = 0,
  total,
  className = "",
  showLabels = true,
}: ProjectStatusBarProps) {
  const calcTotal = total !== undefined ? total : completed + inProgress + pending + overdue
  if (calcTotal === 0) {
    return (
      <div className={`space-y-1.5 ${className}`}>
        <div className="bg-muted h-2 w-full rounded-full" />
        {showLabels && <p className="text-muted-foreground text-[11px]">No tasks logged</p>}
      </div>
    )
  }

  const completedPct = Math.round((completed / calcTotal) * 100)
  const inProgressPct = Math.round((inProgress / calcTotal) * 100)
  const overduePct = Math.round((overdue / calcTotal) * 100)
  const pendingPct = Math.max(0, 100 - (completedPct + inProgressPct + overduePct))

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Segmented Progress Bar */}
      <div className="bg-muted flex h-2 w-full overflow-hidden rounded-full">
        {completedPct > 0 && (
          <div
            className="bg-emerald-500 transition-all duration-300"
            style={{ width: `${completedPct}%` }}
            title={`Completed: ${completed} (${completedPct}%)`}
          />
        )}
        {inProgressPct > 0 && (
          <div
            className="bg-blue-500 transition-all duration-300"
            style={{ width: `${inProgressPct}%` }}
            title={`In Progress: ${inProgress} (${inProgressPct}%)`}
          />
        )}
        {pendingPct > 0 && (
          <div
            className="bg-slate-300 transition-all duration-300 dark:bg-slate-700"
            style={{ width: `${pendingPct}%` }}
            title={`Pending: ${pending} (${pendingPct}%)`}
          />
        )}
        {overduePct > 0 && (
          <div
            className="bg-red-500 transition-all duration-300"
            style={{ width: `${overduePct}%` }}
            title={`Overdue: ${overdue} (${overduePct}%)`}
          />
        )}
      </div>

      {/* Clean Badges Legend */}
      {showLabels && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            {completed} Done ({completedPct}%)
          </span>
          {inProgress > 0 && (
            <span className="flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
              {inProgress} In Progress
            </span>
          )}
          {pending > 0 && (
            <span className="text-muted-foreground flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
              {pending} Pending
            </span>
          )}
          {overdue > 0 && (
            <span className="flex items-center gap-1 font-semibold text-red-600 dark:text-red-400">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
              {overdue} Overdue
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The project figures kept out of the table's columns — shown when a project
 * row is expanded, on both the admin console and the staff projects page.
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
  const variance = formatVariance(health?.variancePct)
  const items: Array<{ label: string; help?: string; value: ReactNode }> = [
    { label: "Technology", value: project.technology_type || "-" },
    { label: "Capacity", value: formatCapacity(project.capacity_w) },
    {
      label: "Health",
      help: PROJECT_METRIC_HELP.health,
      value: health ? <HealthBadge status={health.status} /> : "-",
    },
    {
      label: "Schedule Elapsed",
      help: PROJECT_METRIC_HELP.elapsed,
      value: !health || health.timeElapsedPct === null ? "-" : `${health.timeElapsedPct}%`,
    },
    {
      label: "Schedule Variance",
      help: PROJECT_METRIC_HELP.variance,
      value: variance ? (
        <span className={(health?.variancePct ?? 0) < 0 ? "font-semibold text-red-500" : undefined}>{variance}</span>
      ) : (
        "-"
      ),
    },
    {
      label: "Overdue Tasks",
      help: PROJECT_METRIC_HELP.overdue,
      value: health ? (
        <span className={health.overdueCount > 0 ? "font-semibold text-red-600 dark:text-red-400" : undefined}>
          {health.overdueCount}
        </span>
      ) : (
        "-"
      ),
    },
  ]

  return (
    <div className="space-y-3">
      <dl className="bg-background grid grid-cols-2 gap-3 rounded-lg border p-3 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((item) => (
          <div key={item.label} className="min-w-0 space-y-1">
            <dt className="text-muted-foreground inline-flex items-center gap-1 text-[11px] font-medium">
              {item.label}
              {item.help && <ColumnHelp label={item.label} text={item.help} />}
            </dt>
            <dd className="truncate text-sm font-medium">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
