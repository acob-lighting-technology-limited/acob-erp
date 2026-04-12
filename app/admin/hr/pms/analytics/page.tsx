"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BarChart3, Download, Loader2, TrendingDown, TrendingUp, Users } from "lucide-react"
import { toast } from "sonner"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/ui/stat-card"
import { exportPmsRowsToExcel } from "@/lib/pms/export"

type ReviewRow = {
  id: string
  user_id: string | null
  review_cycle_id: string | null
  kpi_score: number | null
  cbt_score: number | null
  attendance_score: number | null
  behaviour_score: number | null
  final_score: number | null
  status: string | null
  user?: {
    id: string
    first_name: string | null
    last_name: string | null
    department?: string | null
  } | null
  cycle?: {
    id: string
    name: string
    review_type: string
  } | null
}

type Cycle = {
  id: string
  name: string
  status: string | null
}

function formatName(user: ReviewRow["user"]) {
  if (!user) return "Unknown"
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Unknown"
}

function scoreToTier(score: number | null): {
  label: string
  variant: "default" | "secondary" | "outline" | "destructive"
} {
  if (score === null) return { label: "No Score", variant: "outline" }
  if (score >= 80) return { label: "High Performer", variant: "default" }
  if (score >= 60) return { label: "Meets Expectations", variant: "secondary" }
  if (score >= 40) return { label: "Needs Improvement", variant: "outline" }
  return { label: "At Risk", variant: "destructive" }
}

export default function PmsAnalyticsPage() {
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cycleFilter, setCycleFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [reviewsRes, cyclesRes] = await Promise.all([
        fetch("/api/hr/performance/reviews?limit=200"),
        fetch("/api/hr/performance/cycles"),
      ])
      const [reviewsData, cyclesData] = await Promise.all([
        reviewsRes.json().catch(() => ({})),
        cyclesRes.json().catch(() => ({})),
      ])
      if (!reviewsRes.ok) throw new Error(reviewsData?.error || "Failed to load reviews")
      setReviews(reviewsData?.data || [])
      setCycles(cyclesData?.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const departments = useMemo(
    () => Array.from(new Set(reviews.map((r) => r.user?.department).filter(Boolean) as string[])).sort(),
    [reviews]
  )

  const filtered = useMemo(() => {
    return reviews.filter((r) => {
      const cycleMatch = cycleFilter === "all" || r.review_cycle_id === cycleFilter
      const deptMatch = departmentFilter === "all" || r.user?.department === departmentFilter
      return cycleMatch && deptMatch
    })
  }, [reviews, cycleFilter, departmentFilter])

  const withScores = useMemo(() => filtered.filter((r) => typeof r.final_score === "number"), [filtered])

  const scores = useMemo(() => withScores.map((r) => r.final_score as number), [withScores])

  const mean = scores.length > 0 ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100 : null

  const variance =
    scores.length > 1 && mean !== null ? scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (scores.length - 1) : 0
  const stddev = Math.round(Math.sqrt(variance) * 100) / 100

  const highPerformers = withScores.filter((r) => (r.final_score as number) >= 80)
  const atRisk = withScores.filter((r) => (r.final_score as number) < 40)

  // Score distribution in 10-point buckets
  const distribution = useMemo(() => {
    const buckets: Record<string, number> = {
      "0–10": 0,
      "11–20": 0,
      "21–30": 0,
      "31–40": 0,
      "41–50": 0,
      "51–60": 0,
      "61–70": 0,
      "71–80": 0,
      "81–90": 0,
      "91–100": 0,
    }
    const labels = Object.keys(buckets)
    for (const score of scores) {
      const idx = Math.min(Math.floor(score / 10), 9)
      buckets[labels[idx]] = (buckets[labels[idx]] || 0) + 1
    }
    return labels.map((label) => ({ label, count: buckets[label] }))
  }, [scores])

  const maxBucket = Math.max(...distribution.map((b) => b.count), 1)

  // Department averages
  const deptAverages = useMemo(() => {
    const map = new Map<string, number[]>()
    for (const r of withScores) {
      const dept = r.user?.department || "Unassigned"
      const list = map.get(dept) || []
      list.push(r.final_score as number)
      map.set(dept, list)
    }
    return Array.from(map.entries())
      .map(([dept, s]) => ({
        dept,
        avg: Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 100) / 100,
        count: s.length,
      }))
      .sort((a, b) => b.avg - a.avg)
  }, [withScores])

  // KPI component averages
  const componentAvgs = useMemo(() => {
    const pick = (key: "kpi_score" | "cbt_score" | "attendance_score" | "behaviour_score") => {
      const vals = filtered.map((r) => r[key]).filter((v): v is number => typeof v === "number")
      return vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null
    }
    return {
      kpi: pick("kpi_score"),
      cbt: pick("cbt_score"),
      attendance: pick("attendance_score"),
      behaviour: pick("behaviour_score"),
    }
  }, [filtered])

  const exportRows = withScores
    .sort((a, b) => (b.final_score as number) - (a.final_score as number))
    .map((r, i) => {
      const tier = scoreToTier(r.final_score)
      return {
        "S/N": i + 1,
        Employee: formatName(r.user),
        Department: r.user?.department || "-",
        Quarter: r.cycle?.name || "-",
        KPI: r.kpi_score ?? "-",
        CBT: r.cbt_score ?? "-",
        Attendance: r.attendance_score ?? "-",
        Behaviour: r.behaviour_score ?? "-",
        Final: r.final_score ?? "-",
        Tier: tier.label,
      }
    })

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="PMS Analytics"
        description="Performance distribution, trends, department benchmarking, and HiPo/At-Risk identification."
        icon={BarChart3}
        backLink={{ href: "/admin/hr/pms", label: "Back to PMS" }}
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={exportRows.length === 0}
            onClick={() =>
              void exportPmsRowsToExcel(exportRows, `pms-analytics-${new Date().toISOString().slice(0, 10)}`)
            }
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Select value={cycleFilter} onValueChange={setCycleFilter}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="All Cycles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cycles</SelectItem>
            {cycles.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground flex items-center justify-center gap-2 py-16">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading analytics…
        </div>
      ) : error ? (
        <div className="space-y-2 py-8">
          <p className="text-sm text-red-500">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void loadData()}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            <StatCard title="Employees" value={withScores.length} icon={Users} description="With scored reviews" />
            <StatCard
              title="Mean Score"
              value={mean !== null ? `${mean}%` : "-"}
              icon={BarChart3}
              description="Average final score"
            />
            <StatCard title="Std Dev" value={`${stddev}%`} icon={BarChart3} description="Score spread" />
            <StatCard
              title="High Performers"
              value={highPerformers.length}
              icon={TrendingUp}
              description="Score ≥ 80%"
            />
            <StatCard title="At Risk" value={atRisk.length} icon={TrendingDown} description="Score < 40%" />
          </div>

          {/* Component averages */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["KPI", componentAvgs.kpi],
                ["CBT", componentAvgs.cbt],
                ["Attendance", componentAvgs.attendance],
                ["Behaviour", componentAvgs.behaviour],
              ] as [string, number | null][]
            ).map(([label, val]) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-4">
                  <p className="text-muted-foreground text-sm">{label} Avg</p>
                  <p className="text-xl font-semibold">{val !== null ? `${val}%` : "-"}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Score Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Score Distribution</CardTitle>
                <CardDescription>How final scores are spread across 10-point bands.</CardDescription>
              </CardHeader>
              <CardContent>
                {scores.length === 0 ? (
                  <p className="text-muted-foreground py-4 text-center text-sm">No scores to show.</p>
                ) : (
                  <div className="space-y-2">
                    {distribution.map(({ label, count }) => (
                      <div key={label} className="flex items-center gap-3">
                        <span className="w-14 shrink-0 font-mono text-xs">{label}</span>
                        <div className="flex h-5 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                          <div
                            className="bg-emerald-500 transition-all"
                            style={{ width: `${(count / maxBucket) * 100}%` }}
                          />
                        </div>
                        <span className="text-muted-foreground w-8 shrink-0 text-right text-xs">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Department Rankings */}
            <Card>
              <CardHeader>
                <CardTitle>Department Averages</CardTitle>
                <CardDescription>Average final PMS score per department.</CardDescription>
              </CardHeader>
              <CardContent>
                {deptAverages.length === 0 ? (
                  <p className="text-muted-foreground py-4 text-center text-sm">No department data.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Department</TableHead>
                          <TableHead>Avg</TableHead>
                          <TableHead>N</TableHead>
                          <TableHead>Tier</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deptAverages.map(({ dept, avg, count }) => {
                          const tier = scoreToTier(avg)
                          return (
                            <TableRow key={dept}>
                              <TableCell className="font-medium">{dept}</TableCell>
                              <TableCell>{avg}%</TableCell>
                              <TableCell>{count}</TableCell>
                              <TableCell>
                                <Badge variant={tier.variant}>{tier.label}</Badge>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* HiPo & At-Risk tables */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-600">
                  <TrendingUp className="h-4 w-4" />
                  High Performers (≥ 80%)
                </CardTitle>
                <CardDescription>Top decile — candidates for retention, promotion, and HiPo tagging.</CardDescription>
              </CardHeader>
              <CardContent>
                {highPerformers.length === 0 ? (
                  <p className="text-muted-foreground py-4 text-center text-sm">
                    No employees with score ≥ 80% in this filter.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Dept</TableHead>
                          <TableHead>Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {highPerformers
                          .sort((a, b) => (b.final_score as number) - (a.final_score as number))
                          .map((r) => (
                            <TableRow key={r.id}>
                              <TableCell className="font-medium">{formatName(r.user)}</TableCell>
                              <TableCell>{r.user?.department || "-"}</TableCell>
                              <TableCell>
                                <Badge>{r.final_score}%</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-500">
                  <TrendingDown className="h-4 w-4" />
                  At Risk (&lt; 40%)
                </CardTitle>
                <CardDescription>Employees needing intervention, PIP, or support plans.</CardDescription>
              </CardHeader>
              <CardContent>
                {atRisk.length === 0 ? (
                  <p className="text-muted-foreground py-4 text-center text-sm">No employees at risk in this filter.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Dept</TableHead>
                          <TableHead>Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {atRisk
                          .sort((a, b) => (a.final_score as number) - (b.final_score as number))
                          .map((r) => (
                            <TableRow key={r.id}>
                              <TableCell className="font-medium">{formatName(r.user)}</TableCell>
                              <TableCell>{r.user?.department || "-"}</TableCell>
                              <TableCell>
                                <Badge variant="destructive">{r.final_score}%</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </PageWrapper>
  )
}
