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
      return <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500">On Track</Badge>
    case "at_risk":
      return <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-500">At Risk</Badge>
    case "behind_schedule":
      return <Badge className="border-red-500/20 bg-red-500/10 text-red-500">Behind Schedule</Badge>
    case "completed":
      return <Badge className="border-blue-500/20 bg-blue-500/10 text-blue-500">Completed</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

/**
 * The project figures kept out of the table's columns — shown when a project
 * row is expanded, on both the admin console and the staff projects page.
 */
export function ProjectSummary({
  project,
  health,
}: {
  project: { technology_type: string | null; capacity_w: number | null }
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
      label: "Elapsed",
      help: PROJECT_METRIC_HELP.elapsed,
      value: !health || health.timeElapsedPct === null ? "-" : `${health.timeElapsedPct}%`,
    },
    {
      label: "Variance",
      help: PROJECT_METRIC_HELP.variance,
      value: variance ? (
        <span className={(health?.variancePct ?? 0) < 0 ? "text-red-500" : undefined}>{variance}</span>
      ) : (
        "-"
      ),
    },
    {
      label: "Overdue",
      help: PROJECT_METRIC_HELP.overdue,
      value: health ? (
        <span className={health.overdueCount > 0 ? "text-amber-600 dark:text-amber-400" : undefined}>
          {health.overdueCount}
        </span>
      ) : (
        "-"
      ),
    },
  ]

  return (
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
  )
}
