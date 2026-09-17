"use client"

import Link from "next/link"
import { Layers } from "lucide-react"
import { portfolioHref } from "@/lib/projects/links"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { HEALTH_TONE, LabelledBar, PortfolioStatusBadge } from "@/components/projects/project-summary"
import { cn } from "@/lib/utils"
import { PROJECT_HEALTH_LABELS, plural, type PortfolioHealth, type ProjectHealthStatus } from "@/lib/projects/health"
import type { Portfolio, ProjectHealthRow } from "./portfolios-content"

interface PortfolioOverviewProps {
  rows: Portfolio[]
  unassigned?: { projects: ProjectHealthRow[]; rollup: PortfolioHealth }
  isAdmin: boolean
}

const STATUS_ORDER = ["completed", "on_track", "at_risk", "behind_schedule"] as const

function statusCounts(rollup: PortfolioHealth): Record<ProjectHealthStatus, number> {
  return {
    on_track: rollup.onTrack,
    at_risk: rollup.atRisk,
    behind_schedule: rollup.behindSchedule,
    completed: rollup.completed,
  }
}

/** One bar split by how many projects sit in each state, with its counts underneath. */
function StatusMix({ rollup }: { rollup: PortfolioHealth }) {
  const counts = statusCounts(rollup)
  const present = STATUS_ORDER.filter((status) => counts[status] > 0)

  if (rollup.projectCount === 0) {
    return <p className="text-muted-foreground text-xs italic">No projects yet</p>
  }

  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">Projects</span>
        <span className="text-muted-foreground">
          <span className="text-foreground font-semibold tabular-nums">{rollup.completed}</span> of{" "}
          {rollup.projectCount} done
        </span>
      </div>
      <div className="bg-muted flex h-2 w-full gap-0.5 overflow-hidden rounded-full">
        {present.map((status) => (
          <div
            key={status}
            className={cn("h-full first:rounded-l-full last:rounded-r-full", HEALTH_TONE[status].dot)}
            style={{ width: `${(counts[status] / rollup.projectCount) * 100}%` }}
            title={`${PROJECT_HEALTH_LABELS[status]}: ${counts[status]}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
        {present.map((status) => (
          <span key={status} className="text-muted-foreground inline-flex items-center gap-1">
            <span className={cn("h-1.5 w-1.5 rounded-full", HEALTH_TONE[status].dot)} />
            <span className="text-foreground font-medium">{counts[status]}</span>
            {PROJECT_HEALTH_LABELS[status].toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  )
}

export function PortfolioOverview({ rows, unassigned, isAdmin }: PortfolioOverviewProps) {
  const portfolioLines = [
    ...rows.map((portfolio) => ({
      key: portfolio.id,
      code: portfolio.code,
      name: portfolio.name,
      status: portfolio.status as string | null,
      rollup: portfolio.rollup,
    })),
    ...(unassigned && unassigned.rollup.projectCount > 0
      ? [{ key: "unassigned", code: null, name: "Not in a portfolio", status: null, rollup: unassigned.rollup }]
      : []),
  ]

  if (portfolioLines.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <Layers className="text-muted-foreground mx-auto h-10 w-10 opacity-60" />
        <h3 className="mt-3 text-sm font-semibold">Nothing to show yet</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Create a portfolio and add projects to it to see them here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader className="space-y-1 border-b py-4">
          <CardTitle className="text-base">Portfolios</CardTitle>
          <CardDescription>How the projects in each portfolio are doing.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y">
            {portfolioLines.map((line) => (
              <li
                key={line.key}
                className="grid grid-cols-1 items-center gap-x-6 gap-y-3 px-6 py-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_6rem]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    {line.key === "unassigned" ? (
                      <p className="text-muted-foreground truncate text-sm font-semibold">{line.name}</p>
                    ) : (
                      <Link
                        href={portfolioHref(line.key, isAdmin)}
                        className="hover:text-primary block truncate text-sm font-semibold hover:underline"
                      >
                        {line.name}
                      </Link>
                    )}
                    {line.code && <p className="text-muted-foreground font-mono text-[11px]">{line.code}</p>}
                  </div>
                </div>
                <StatusMix rollup={line.rollup} />
                {line.rollup.planCount > 0 ? (
                  <LabelledBar
                    label="Plans"
                    value={Math.round((line.rollup.plansDoneCount / line.rollup.planCount) * 100)}
                    note={`${line.rollup.plansDoneCount} of ${plural(line.rollup.planCount, "plan")} finished`}
                  />
                ) : (
                  <p className="text-muted-foreground text-xs italic">No plans yet</p>
                )}
                {line.rollup.taskCount > 0 ? (
                  <LabelledBar
                    label="Work done"
                    value={line.rollup.workDonePct}
                    note={`${line.rollup.doneCount} of ${plural(line.rollup.taskCount, "task")}`}
                  />
                ) : (
                  <p className="text-muted-foreground text-xs italic">No tasks yet</p>
                )}
                <div className="md:text-right">{line.status && <PortfolioStatusBadge status={line.status} />}</div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
