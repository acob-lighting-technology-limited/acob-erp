"use client"

import { useMemo, useState, useEffect } from "react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
} from "recharts"
import { AlertCircle, CheckCircle2, AlertTriangle, Layers, Clock, TrendingUp } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Portfolio } from "./portfolios-content"

interface PortfolioAnalyticsProps {
  rows: Portfolio[]
  unassigned?: Portfolio["rollup"]
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

export function PortfolioAnalytics({ rows, unassigned }: PortfolioAnalyticsProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Aggregate stats across all portfolios
  const summary = useMemo(() => {
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

  // Data for Delivery & Quality horizontal bar chart
  const deliveryQualityData = useMemo(() => {
    return rows.map((p) => {
      const displayName = p.code ? `${p.code} - ${p.name}` : p.name
      const shortName = displayName.length > 22 ? `${displayName.slice(0, 20)}...` : displayName
      return {
        fullName: displayName,
        name: shortName,
        delivery: p.rollup.deliveryPct ?? 0,
        quality: p.rollup.qualityPct ?? 0,
      }
    })
  }, [rows])

  // Data for Overall Project Health Donut chart
  const healthDistributionData = useMemo(() => {
    return [
      { name: "On Track", value: summary.onTrackCount, color: HEALTH_COLORS.on_track },
      { name: "At Risk", value: summary.atRiskCount, color: HEALTH_COLORS.at_risk },
      { name: "Behind Schedule", value: summary.behindScheduleCount, color: HEALTH_COLORS.behind_schedule },
      { name: "Completed", value: summary.completedCount, color: HEALTH_COLORS.completed },
    ].filter((item) => item.value > 0)
  }, [summary])

  // Data for Projects and Overdue counts per portfolio
  const volumeData = useMemo(() => {
    return rows.map((p) => {
      const displayName = p.code ? p.code : p.name
      const shortName = displayName.length > 15 ? `${displayName.slice(0, 13)}...` : displayName
      return {
        fullName: p.name,
        name: shortName,
        projects: p.rollup.projectCount,
        overdue: p.rollup.overdueCount,
      }
    })
  }, [rows])

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
      {/* Quick KPI Highlights */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="bg-card rounded-lg border p-3">
          <div className="text-muted-foreground flex items-center justify-between text-xs font-medium">
            <span>Avg Delivery</span>
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <p className="mt-1 text-xl font-bold">{summary.avgDelivery}%</p>
          <p className="text-muted-foreground mt-0.5 text-[11px]">Across all active tasks</p>
        </div>

        <div className="bg-card rounded-lg border p-3">
          <div className="text-muted-foreground flex items-center justify-between text-xs font-medium">
            <span>Avg Quality</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <p className="mt-1 text-xl font-bold">{summary.avgQuality}%</p>
          <p className="text-muted-foreground mt-0.5 text-[11px]">Average review ratings</p>
        </div>

        <div className="bg-card rounded-lg border p-3">
          <div className="text-muted-foreground flex items-center justify-between text-xs font-medium">
            <span>Health Rate</span>
            <AlertCircle className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <p className="mt-1 text-xl font-bold">{summary.healthyRate}%</p>
          <p className="text-muted-foreground mt-0.5 text-[11px]">On track or completed</p>
        </div>

        <div className="bg-card rounded-lg border p-3">
          <div className="text-muted-foreground flex items-center justify-between text-xs font-medium">
            <span>Attention Needed</span>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <p className="mt-1 text-xl font-bold text-amber-600 dark:text-amber-400">
            {summary.atRiskCount + summary.behindScheduleCount}
          </p>
          <p className="text-muted-foreground mt-0.5 text-[11px]">Projects at risk or behind</p>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Horizontal Bar Chart: Delivery & Quality by Portfolio */}
        <Card className="lg:col-span-7">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Delivery & Quality by Portfolio</CardTitle>
            <CardDescription className="text-xs">
              Delivery progress derived from task completions compared with task quality scores.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div style={{ height: Math.max(260, deliveryQualityData.length * 48) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={deliveryQualityData}
                  layout="vertical"
                  margin={{ top: 10, right: 25, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    unit="%"
                    tickLine={false}
                    axisLine={false}
                    className="text-[11px]"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    width={110}
                    className="text-[11px]"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload as { fullName: string; delivery: number; quality: number }
                        return (
                          <ChartTooltip
                            active={active}
                            label={data.fullName}
                            payload={[
                              { name: "Delivered", value: data.delivery, unit: "%", color: "#10b981" },
                              { name: "Quality", value: data.quality, unit: "%", color: "#3b82f6" },
                            ]}
                          />
                        )
                      }
                      return null
                    }}
                  />
                  <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: 8, fontSize: "11px" }} />
                  <Bar dataKey="delivery" name="Delivery %" fill="#10b981" radius={[0, 4, 4, 0]} maxBarSize={14} />
                  <Bar dataKey="quality" name="Quality %" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Donut Chart: Project Health Distribution */}
        <Card className="lg:col-span-5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Project Health Distribution</CardTitle>
            <CardDescription className="text-xs">
              Overall health breakdown across all {summary.totalProjects} portfolio projects.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={healthDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {healthDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0]
                        const count = Number(item.value)
                        const pct = summary.totalProjects > 0 ? Math.round((count / summary.totalProjects) * 100) : 0
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
            <div className="grid grid-cols-2 gap-2 border-t pt-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">On Track:</span>
                <span className="text-foreground font-semibold">{summary.onTrackCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span className="text-muted-foreground">At Risk:</span>
                <span className="text-foreground font-semibold">{summary.atRiskCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <span className="text-muted-foreground">Behind:</span>
                <span className="text-foreground font-semibold">{summary.behindScheduleCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                <span className="text-muted-foreground">Completed:</span>
                <span className="text-foreground font-semibold">{summary.completedCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects Volume & Overdue Tasks Bar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Project Load & Overdue Tasks</CardTitle>
          <CardDescription className="text-xs">
            Comparison of total projects hosted vs. overdue task bottlenecks per portfolio.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} className="text-[11px]" />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} className="text-[11px]" />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as { fullName: string; projects: number; overdue: number }
                      return (
                        <ChartTooltip
                          active={active}
                          label={data.fullName}
                          payload={[
                            { name: "Projects", value: data.projects, color: "#8b5cf6" },
                            { name: "Overdue Tasks", value: data.overdue, color: "#f43f5e" },
                          ]}
                        />
                      )
                    }
                    return null
                  }}
                />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: 8, fontSize: "11px" }} />
                <Bar dataKey="projects" name="Total Projects" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="overdue" name="Overdue Tasks" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

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
  )
}
