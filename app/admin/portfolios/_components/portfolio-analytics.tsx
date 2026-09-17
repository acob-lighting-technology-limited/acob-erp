"use client"

import { useMemo, useState, useEffect } from "react"
import Link from "next/link"
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts"
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Clock,
  TrendingUp,
  FolderKanban,
  ExternalLink,
  X,
  Filter,
  ShieldCheck,
  ArrowRight,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { HealthBadge, PortfolioStatusBadge, ProjectStatusBar } from "@/components/projects/project-summary"
import type { Portfolio } from "./portfolios-content"
import { projectHref } from "./project-href"

interface PortfolioAnalyticsProps {
  rows: Portfolio[]
  unassigned?: Portfolio["rollup"]
  focusedPortfolioId?: string | null
  onFocusPortfolio?: (id: string | null) => void
  isAdmin?: boolean
}

interface CustomTooltipPayloadItem {
  name: string
  value: number | string
  color?: string
  fill?: string
  unit?: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: CustomTooltipPayloadItem[]
  label?: string
}

function ChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover text-popover-foreground rounded-lg border p-2.5 text-xs shadow-md">
        {label && <p className="text-foreground mb-1.5 font-semibold">{label}</p>}
        <div className="space-y-1">
          {payload.map((item, idx) => (
            <div key={`${item.name}-${idx}`} className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: item.color || item.fill }}
                />
                {item.name}:
              </span>
              <span className="text-foreground font-semibold">
                {item.value}
                {item.unit || ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

const HEALTH_COLORS = {
  on_track: "#10b981", // Emerald
  at_risk: "#f59e0b", // Amber
  behind_schedule: "#ef4444", // Red
  completed: "#3b82f6", // Blue
} as const

export function PortfolioAnalytics({
  rows,
  unassigned,
  focusedPortfolioId,
  onFocusPortfolio,
  isAdmin = true,
}: PortfolioAnalyticsProps) {
  const [internalFocusedId, setInternalFocusedId] = useState<string | null>(focusedPortfolioId ?? null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    setInternalFocusedId(focusedPortfolioId ?? null)
  }, [focusedPortfolioId])

  const activeFocusId = focusedPortfolioId !== undefined ? focusedPortfolioId : internalFocusedId

  const handleSelectPortfolio = (id: string | null) => {
    setInternalFocusedId(id)
    onFocusPortfolio?.(id)
  }

  const focusedPortfolio = useMemo(() => {
    if (!activeFocusId || activeFocusId === "all") return null
    return rows.find((p) => p.id === activeFocusId) ?? null
  }, [rows, activeFocusId])

  const portfolioSelectOptions = useMemo(() => {
    return [
      { value: "all", label: "All Portfolios (Overview)" },
      ...rows.map((p) => ({
        value: p.id,
        label: p.code ? `${p.code} — ${p.name}` : p.name,
      })),
    ]
  }, [rows])

  // Macro Summary across all portfolios
  const macroSummary = useMemo(() => {
    const totalPortfolios = rows.length
    let totalProjects = 0
    let totalDeliveredPctSum = 0
    let deliveredPctCount = 0
    let totalQualityPctSum = 0
    let qualityPctCount = 0
    let totalOverdue = 0

    let onTrackCount = 0
    let atRiskCount = 0
    let behindScheduleCount = 0
    let completedCount = 0

    for (const p of rows) {
      totalProjects += p.rollup.projectCount
      totalOverdue += p.rollup.overdueCount
      onTrackCount += p.rollup.onTrack
      atRiskCount += p.rollup.atRisk
      behindScheduleCount += p.rollup.behindSchedule
      completedCount += p.rollup.completed

      if (p.rollup.deliveryPct !== null) {
        totalDeliveredPctSum += p.rollup.deliveryPct
        deliveredPctCount++
      }
      if (p.rollup.qualityPct !== null) {
        totalQualityPctSum += p.rollup.qualityPct
        qualityPctCount++
      }
    }

    const avgDelivery = deliveredPctCount > 0 ? Math.round(totalDeliveredPctSum / deliveredPctCount) : 0
    const avgQuality = qualityPctCount > 0 ? Math.round(totalQualityPctSum / qualityPctCount) : 0
    const healthyProjects = onTrackCount + completedCount
    const healthyRate = totalProjects > 0 ? Math.round((healthyProjects / totalProjects) * 100) : 0

    return {
      totalPortfolios,
      totalProjects,
      avgDelivery,
      avgQuality,
      totalOverdue,
      onTrackCount,
      atRiskCount,
      behindScheduleCount,
      completedCount,
      healthyRate,
    }
  }, [rows])

  // Macro Chart: Project Health Donut chart
  const macroHealthDistributionData = useMemo(() => {
    return [
      { name: "On Track", value: macroSummary.onTrackCount, color: HEALTH_COLORS.on_track },
      { name: "At Risk", value: macroSummary.atRiskCount, color: HEALTH_COLORS.at_risk },
      { name: "Behind Schedule", value: macroSummary.behindScheduleCount, color: HEALTH_COLORS.behind_schedule },
      { name: "Completed", value: macroSummary.completedCount, color: HEALTH_COLORS.completed },
    ].filter((item) => item.value > 0)
  }, [macroSummary])

  // Single Portfolio Data (when focused)
  const singlePortfolioData = useMemo(() => {
    if (!focusedPortfolio) return null

    const healthBreakdown = [
      { name: "On Track", value: focusedPortfolio.rollup.onTrack, color: HEALTH_COLORS.on_track },
      { name: "At Risk", value: focusedPortfolio.rollup.atRisk, color: HEALTH_COLORS.at_risk },
      { name: "Behind Schedule", value: focusedPortfolio.rollup.behindSchedule, color: HEALTH_COLORS.behind_schedule },
      { name: "Completed", value: focusedPortfolio.rollup.completed, color: HEALTH_COLORS.completed },
    ].filter((item) => item.value > 0)

    return {
      healthBreakdown,
      projects: focusedPortfolio.projects,
    }
  }, [focusedPortfolio])

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <Layers className="text-muted-foreground mx-auto h-10 w-10 opacity-60" />
        <h3 className="mt-3 text-sm font-semibold">No Portfolio Data Available</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Create portfolios and assign projects to visualize delivery trends and health distribution.
        </p>
      </div>
    )
  }

  if (!isMounted) {
    return <div className="bg-muted/40 h-64 animate-pulse rounded-xl" />
  }

  return (
    <div className="space-y-6">
      {/* Portfolio Focus Control Bar */}
      <div className="bg-card flex flex-col gap-3 rounded-xl border p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Filter className="text-muted-foreground h-4 w-4 shrink-0" />
          <span className="text-foreground text-xs font-semibold">Focus Portfolio:</span>
          <SearchableSelect
            value={activeFocusId || "all"}
            onValueChange={(val) => handleSelectPortfolio(val === "all" ? null : val)}
            options={portfolioSelectOptions}
            placeholder="Select a portfolio to focus..."
            searchPlaceholder="Search portfolios..."
            className="w-full sm:w-72"
          />
        </div>

        {focusedPortfolio && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">
              Showing: <strong className="text-foreground">{focusedPortfolio.name}</strong>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSelectPortfolio(null)}
              className="h-7 gap-1 px-2 text-xs"
            >
              <X className="h-3.5 w-3.5" />
              Reset to All
            </Button>
          </div>
        )}
      </div>

      {/* ====================================================================== */}
      {/* VIEW A: SINGLE PORTFOLIO FOCUSED VIEW */}
      {/* ====================================================================== */}
      {focusedPortfolio && singlePortfolioData ? (
        <div className="space-y-6">
          {/* Portfolio Header Info Card */}
          <div className="bg-card rounded-xl border p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-foreground text-base font-bold">
                    {focusedPortfolio.code
                      ? `${focusedPortfolio.code} — ${focusedPortfolio.name}`
                      : focusedPortfolio.name}
                  </h3>
                  <PortfolioStatusBadge status={focusedPortfolio.status} />
                </div>
                {focusedPortfolio.description && (
                  <p className="text-muted-foreground mt-1 text-xs">{focusedPortfolio.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">
                  {focusedPortfolio.projects.length} project{focusedPortfolio.projects.length === 1 ? "" : "s"}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  {focusedPortfolio.rollup.overdueCount} overdue task
                  {focusedPortfolio.rollup.overdueCount === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </div>

          {/* Focused KPI Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="bg-card rounded-lg border p-3">
              <div className="text-muted-foreground flex items-center justify-between text-xs font-medium">
                <span>Delivery Progress</span>
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              </div>
              <p className="mt-1 text-xl font-bold">{focusedPortfolio.rollup.deliveryPct ?? 0}%</p>
              <div className="mt-2">
                <Progress value={focusedPortfolio.rollup.deliveryPct ?? 0} className="h-1.5" />
              </div>
            </div>

            <div className="bg-card rounded-lg border p-3">
              <div className="text-muted-foreground flex items-center justify-between text-xs font-medium">
                <span>Quality Score</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <p className="mt-1 text-xl font-bold">{focusedPortfolio.rollup.qualityPct ?? 0}%</p>
              <p className="text-muted-foreground mt-1 text-[11px]">Task review ratings</p>
            </div>

            <div className="bg-card rounded-lg border p-3">
              <div className="text-muted-foreground flex items-center justify-between text-xs font-medium">
                <span>Schedule Health</span>
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              </div>
              <p className="mt-1 text-xl font-bold">
                {focusedPortfolio.rollup.onTrack + focusedPortfolio.rollup.completed} /{" "}
                {focusedPortfolio.projects.length}
              </p>
              <p className="text-muted-foreground mt-1 text-[11px]">Projects on track</p>
            </div>

            <div className="bg-card rounded-lg border p-3">
              <div className="text-muted-foreground flex items-center justify-between text-xs font-medium">
                <span>Action Items</span>
                <AlertTriangle
                  className={
                    focusedPortfolio.rollup.overdueCount > 0 ? "h-3.5 w-3.5 text-red-500" : "h-3.5 w-3.5 text-slate-400"
                  }
                />
              </div>
              <p
                className={
                  focusedPortfolio.rollup.overdueCount > 0
                    ? "mt-1 text-xl font-bold text-red-600 dark:text-red-400"
                    : "mt-1 text-xl font-bold"
                }
              >
                {focusedPortfolio.rollup.overdueCount} Overdue
              </p>
              <p className="text-muted-foreground mt-1 text-[11px]">
                {focusedPortfolio.rollup.atRisk + focusedPortfolio.rollup.behindSchedule} projects at risk
              </p>
            </div>
          </div>

          {focusedPortfolio.projects.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <FolderKanban className="text-muted-foreground mx-auto h-10 w-10 opacity-60" />
              <h3 className="mt-3 text-sm font-semibold">No Projects in this Portfolio</h3>
              <p className="text-muted-foreground mt-1 text-xs">
                Assign projects to {focusedPortfolio.name} to track milestones and delivery.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-foreground text-sm font-semibold">Projects in this Portfolio</h4>
                <span className="text-muted-foreground text-xs">
                  {focusedPortfolio.projects.length} project{focusedPortfolio.projects.length === 1 ? "" : "s"}
                </span>
              </div>

              {/* Clean Project Cards Grid */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {focusedPortfolio.projects.map((proj) => {
                  const completedTasks =
                    proj.taskCount > 0 && proj.deliveryPct !== null
                      ? Math.round((proj.deliveryPct / 100) * proj.taskCount)
                      : 0
                  const pendingTasks = Math.max(0, proj.taskCount - completedTasks - proj.overdueCount)

                  return (
                    <div
                      key={proj.id}
                      className="bg-card hover:border-primary/40 flex flex-col justify-between space-y-3 rounded-xl border p-4 shadow-sm transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <h5 className="text-foreground text-sm font-bold">{proj.project_name}</h5>
                          <HealthBadge status={proj.status} />
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Delivery</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {proj.deliveryPct ?? 0}%
                          </span>
                        </div>
                        <Progress value={proj.deliveryPct ?? 0} className="h-2" />
                      </div>

                      {/* Task Status Bar */}
                      {proj.taskCount > 0 ? (
                        <div className="space-y-1">
                          <ProjectStatusBar
                            completed={completedTasks}
                            pending={pendingTasks}
                            overdue={proj.overdueCount}
                            total={proj.taskCount}
                          />
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-[11px]">No active tasks logged</p>
                      )}

                      {/* Footer Link */}
                      <div className="border-border/40 flex items-center justify-between border-t pt-2 text-xs">
                        <span className="text-muted-foreground">
                          {proj.overdueCount > 0 ? (
                            <span className="font-semibold text-red-600 dark:text-red-400">
                              {proj.overdueCount} overdue task{proj.overdueCount === 1 ? "" : "s"}
                            </span>
                          ) : (
                            "All tasks on schedule"
                          )}
                        </span>
                        <Link
                          href={projectHref(proj.project_name, isAdmin)}
                          className="text-primary inline-flex items-center gap-1 font-medium hover:underline"
                        >
                          View Project
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ====================================================================== */
        /* VIEW B: MACRO OVERVIEW (ALL PORTFOLIOS) */
        /* ====================================================================== */
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="bg-card rounded-lg border p-3">
              <div className="text-muted-foreground flex items-center justify-between text-xs font-medium">
                <span>Total Scope</span>
                <Layers className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <p className="mt-1 text-xl font-bold">{macroSummary.totalPortfolios} Portfolios</p>
              <p className="text-muted-foreground mt-0.5 text-[11px]">{macroSummary.totalProjects} active projects</p>
            </div>

            <div className="bg-card rounded-lg border p-3">
              <div className="text-muted-foreground flex items-center justify-between text-xs font-medium">
                <span>Avg Delivery Rate</span>
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              </div>
              <p className="mt-1 text-xl font-bold">{macroSummary.avgDelivery}%</p>
              <div className="mt-2">
                <Progress value={macroSummary.avgDelivery} className="h-1.5" />
              </div>
            </div>

            <div className="bg-card rounded-lg border p-3">
              <div className="text-muted-foreground flex items-center justify-between text-xs font-medium">
                <span>Schedule Health</span>
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              </div>
              <p className="mt-1 text-xl font-bold">{macroSummary.healthyRate}% Healthy</p>
              <p className="text-muted-foreground mt-0.5 text-[11px]">
                {macroSummary.onTrackCount + macroSummary.completedCount} of {macroSummary.totalProjects} on track
              </p>
            </div>

            <div className="bg-card rounded-lg border p-3">
              <div className="text-muted-foreground flex items-center justify-between text-xs font-medium">
                <span>Action Required</span>
                <AlertTriangle
                  className={
                    macroSummary.atRiskCount + macroSummary.behindScheduleCount > 0
                      ? "h-3.5 w-3.5 text-amber-500"
                      : "h-3.5 w-3.5 text-slate-400"
                  }
                />
              </div>
              <p
                className={
                  macroSummary.atRiskCount + macroSummary.behindScheduleCount > 0
                    ? "mt-1 text-xl font-bold text-amber-600 dark:text-amber-400"
                    : "mt-1 text-xl font-bold"
                }
              >
                {macroSummary.atRiskCount + macroSummary.behindScheduleCount} At Risk
              </p>
              <p className="text-muted-foreground mt-0.5 text-[11px]">{macroSummary.totalOverdue} overdue tasks</p>
            </div>
          </div>

          {/* Clean Dashboard Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Health Distribution Donut */}
            <Card className="lg:col-span-5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Project Health Overview</CardTitle>
                <CardDescription className="text-xs">
                  Status breakdown across all {macroSummary.totalProjects} projects.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={macroHealthDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {macroHealthDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const item = payload[0]
                            const count = Number(item.value)
                            const pct =
                              macroSummary.totalProjects > 0
                                ? Math.round((count / macroSummary.totalProjects) * 100)
                                : 0
                            return (
                              <ChartTooltip
                                active={active}
                                payload={[
                                  {
                                    name: String(item.name),
                                    value: `${count} projects (${pct}%)`,
                                    color: (item.payload as { color?: string })?.color,
                                  },
                                ]}
                              />
                            )
                          }
                          return null
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Health Legend Breakdown */}
                <div className="grid grid-cols-2 gap-2 border-t pt-3 text-xs">
                  <div className="bg-muted/30 flex items-center justify-between rounded-lg p-2">
                    <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      On Track
                    </span>
                    <span className="text-foreground font-bold">{macroSummary.onTrackCount}</span>
                  </div>
                  <div className="bg-muted/30 flex items-center justify-between rounded-lg p-2">
                    <span className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      At Risk
                    </span>
                    <span className="text-foreground font-bold">{macroSummary.atRiskCount}</span>
                  </div>
                  <div className="bg-muted/30 flex items-center justify-between rounded-lg p-2">
                    <span className="flex items-center gap-1.5 font-medium text-red-600 dark:text-red-400">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      Delayed
                    </span>
                    <span className="text-foreground font-bold">{macroSummary.behindScheduleCount}</span>
                  </div>
                  <div className="bg-muted/30 flex items-center justify-between rounded-lg p-2">
                    <span className="flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-400">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      Completed
                    </span>
                    <span className="text-foreground font-bold">{macroSummary.completedCount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Portfolio Performance & Delivery List */}
            <Card className="lg:col-span-7">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Portfolios Performance & Delivery</CardTitle>
                <CardDescription className="text-xs">
                  Progress tracking and health summary per portfolio. Click Focus to drill down.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                <div className="max-h-[380px] space-y-2.5 overflow-y-auto pr-1">
                  {rows.map((p) => {
                    const delivery = p.rollup.deliveryPct ?? 0

                    return (
                      <div
                        key={p.id}
                        className="bg-card hover:border-primary/40 flex flex-col justify-between gap-2.5 rounded-lg border p-3 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-foreground text-xs font-bold">
                              {p.code ? `${p.code} — ${p.name}` : p.name}
                            </span>
                            <PortfolioStatusBadge status={p.status} />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSelectPortfolio(p.id)}
                            className="h-6 gap-1 px-2 text-[11px]"
                          >
                            Focus
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Progress */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">{p.rollup.projectCount} projects</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {delivery}% Delivered
                            </span>
                          </div>
                          <Progress value={delivery} className="h-1.5" />
                        </div>

                        {/* Summary Badges */}
                        <div className="flex flex-wrap items-center gap-2 text-[10px]">
                          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
                            {p.rollup.onTrack} On Track
                          </span>
                          {p.rollup.atRisk > 0 && (
                            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-600 dark:text-amber-400">
                              {p.rollup.atRisk} At Risk
                            </span>
                          )}
                          {p.rollup.behindSchedule > 0 && (
                            <span className="rounded bg-red-500/10 px-1.5 py-0.5 font-semibold text-red-600 dark:text-red-400">
                              {p.rollup.behindSchedule} Behind
                            </span>
                          )}
                          {p.rollup.overdueCount > 0 && (
                            <span className="font-medium text-red-600 dark:text-red-400">
                              · {p.rollup.overdueCount} overdue
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Notice if unassigned projects exist */}
          {unassigned && unassigned.projectCount > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <p className="font-medium">
                  {unassigned.projectCount} project{unassigned.projectCount === 1 ? "" : "s"} not yet assigned to any
                  portfolio
                </p>
                <p className="text-muted-foreground mt-0.5 text-[11px]">
                  {unassigned.atRisk + unassigned.behindSchedule > 0
                    ? `${unassigned.atRisk + unassigned.behindSchedule} unassigned projects are currently at risk or behind schedule.`
                    : "Assign them to a portfolio to include them in rollups and team-level metrics."}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
