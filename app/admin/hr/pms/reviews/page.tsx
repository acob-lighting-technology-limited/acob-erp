"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { Download, FileText, Loader2, Plus, Search } from "lucide-react"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CreateReviewDialog } from "../../performance/_components/create-review-dialog"
import { ExportOptionsDialog } from "@/components/admin/export-options-dialog"
import { exportPmsRowsToExcel, exportPmsRowsToPdf } from "@/lib/pms/export"
import { Badge } from "@/components/ui/badge"

// ─── Calibration sub-component ──────────────────────────────────────────────
function CalibrationView({ reviews }: { reviews: ReviewRow[] }) {
  const byDept = useMemo(() => {
    const map = new Map<string, ReviewRow[]>()
    for (const r of reviews) {
      if (typeof r.final_score !== "number") continue
      const dept = r.user?.department || "Unassigned"
      const list = map.get(dept) || []
      list.push(r)
      map.set(dept, list)
    }

    return Array.from(map.entries()).map(([dept, rows]) => {
      const scores = rows
        .map((r) => r.final_score as number)
        .filter((s): s is number => typeof s === "number")
        .sort((a, b) => b - a)

      const mean =
        scores.length > 0 ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100 : null

      const variance =
        scores.length > 1 && mean !== null
          ? scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (scores.length - 1)
          : 0
      const stddev = Math.round(Math.sqrt(variance) * 100) / 100

      const ranked = rows
        .filter((r) => typeof r.final_score === "number")
        .sort((a, b) => (b.final_score as number) - (a.final_score as number))
        .map((r, i) => ({
          name: `${r.user?.first_name || ""} ${r.user?.last_name || ""}`.trim() || "Employee",
          score: r.final_score as number,
          rank: i + 1,
          percentile: scores.length > 0 ? Math.round(((scores.length - i) / scores.length) * 100 * 100) / 100 : 0,
          z_score:
            stddev > 0 && mean !== null ? Math.round((((r.final_score as number) - mean) / stddev) * 100) / 100 : 0,
        }))

      return { dept, mean, stddev, count: scores.length, ranked }
    })
  }, [reviews])

  if (byDept.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No completed reviews with final scores to calibrate. Use the filters above to narrow to a cycle.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {byDept.map(({ dept, mean, stddev, count, ranked }) => (
        <div key={dept}>
          <div className="mb-2 flex items-center gap-3">
            <h3 className="font-semibold">{dept}</h3>
            <span className="text-muted-foreground text-sm">
              {count} employee{count !== 1 ? "s" : ""} · Mean: <strong>{mean ?? "-"}%</strong> · Std Dev:{" "}
              <strong>{stddev}%</strong>
            </span>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader className="bg-emerald-50 dark:bg-emerald-950/30">
                <TableRow>
                  <TableHead className="w-12">Rank</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Percentile</TableHead>
                  <TableHead>Z-Score</TableHead>
                  <TableHead>Tier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranked.map((entry) => (
                  <TableRow key={entry.name + entry.rank}>
                    <TableCell className="font-medium">#{entry.rank}</TableCell>
                    <TableCell>{entry.name}</TableCell>
                    <TableCell className="font-medium">{entry.score}%</TableCell>
                    <TableCell>{entry.percentile}%</TableCell>
                    <TableCell className={entry.z_score >= 0 ? "text-green-600" : "text-red-500"}>
                      {entry.z_score > 0 ? "+" : ""}
                      {entry.z_score}σ
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={entry.percentile >= 80 ? "default" : entry.percentile >= 40 ? "secondary" : "outline"}
                      >
                        {entry.percentile >= 80 ? "High Performer" : entry.percentile >= 40 ? "Core" : "Needs Support"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  )
}

type ReviewRow = {
  id: string
  created_at: string
  status: string | null
  user_id: string | null
  review_cycle_id: string | null
  kpi_score: number | null
  cbt_score: number | null
  attendance_score: number | null
  behaviour_score: number | null
  final_score: number | null
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

type ReviewsApiPayload = {
  data?: ReviewRow[]
  error?: string
}

type TabMode = "individual" | "department" | "cycle" | "calibration"

function reviewStatusPriority(status: string | null | undefined) {
  const normalized = String(status || "").toLowerCase()
  if (normalized === "completed") return 3
  if (normalized === "submitted") return 2
  if (normalized === "draft") return 1
  return 0
}

function pickCanonicalReview(rows: ReviewRow[]): ReviewRow {
  return [...rows].sort((left, right) => {
    const statusDiff = reviewStatusPriority(right.status) - reviewStatusPriority(left.status)
    if (statusDiff !== 0) return statusDiff
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  })[0]
}

function formatMetric(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2).replace(/\.00$/, "") : "-"
}

function isSubmittedReview(review: ReviewRow) {
  return ["submitted", "completed"].includes(String(review.status || "").toLowerCase())
}

export default function AdminPmsReviewsPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<TabMode>("individual")
  const [isCreateReviewOpen, setIsCreateReviewOpen] = useState(false)
  const PAGE_SIZE = 50
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [totalReviews, setTotalReviews] = useState(0)
  const [page, setPage] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [quarterFilter, setQuarterFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [employeeFilter, setEmployeeFilter] = useState("all")
  const [isExportOpen, setIsExportOpen] = useState(false)
  const hasLoadedReviewsRef = useRef(false)

  const loadReviews = useCallback(async (pageIndex = 0) => {
    if (hasLoadedReviewsRef.current) {
      setIsRefreshing(true)
    } else {
      setIsInitialLoading(true)
    }
    setError(null)
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(pageIndex * PAGE_SIZE),
      })
      const response = await fetch(`/api/hr/performance/reviews?${params}`, { cache: "no-store" })
      const payload = (await response.json().catch(() => null)) as ReviewsApiPayload | null
      if (!response.ok) throw new Error(payload?.error || "Failed to load reviews")
      setReviews(payload?.data || [])
      setTotalReviews((payload as { meta?: { total?: number } })?.meta?.total ?? payload?.data?.length ?? 0)
      setPage(pageIndex)
      hasLoadedReviewsRef.current = true
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load reviews")
    } finally {
      setIsInitialLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadReviews()
  }, [loadReviews])

  const canonicalReviews = useMemo(() => {
    const grouped = new Map<string, ReviewRow[]>()
    for (const review of reviews) {
      const key = `${review.user_id || review.id}:${review.review_cycle_id || "no-cycle"}`
      const current = grouped.get(key) || []
      current.push(review)
      grouped.set(key, current)
    }
    return Array.from(grouped.values()).map((entries) => pickCanonicalReview(entries))
  }, [reviews])

  const quarterOptions = useMemo(
    () => Array.from(new Set(canonicalReviews.map((review) => review.cycle?.name).filter(Boolean) as string[])).sort(),
    [canonicalReviews]
  )

  const departmentOptions = useMemo(
    () =>
      Array.from(new Set(canonicalReviews.map((review) => review.user?.department).filter(Boolean) as string[])).sort(),
    [canonicalReviews]
  )

  const filteredCanonicalReviews = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return canonicalReviews.filter((review) => {
      const employee = `${review.user?.first_name || ""} ${review.user?.last_name || ""}`.trim().toLowerCase()
      const department = String(review.user?.department || "").toLowerCase()
      const cycle = String(review.cycle?.name || "").toLowerCase()
      const matchesQuery =
        query.length === 0 || employee.includes(query) || department.includes(query) || cycle.includes(query)
      const matchesQuarter = quarterFilter === "all" || review.cycle?.name === quarterFilter
      const matchesDepartment = departmentFilter === "all" || review.user?.department === departmentFilter
      const matchesEmployee = employeeFilter === "all" || review.user?.id === employeeFilter
      return matchesQuery && matchesQuarter && matchesDepartment && matchesEmployee
    })
  }, [canonicalReviews, departmentFilter, quarterFilter, searchQuery, employeeFilter])

  const departmentRows = useMemo(() => {
    const grouped = new Map<string, ReviewRow[]>()
    for (const review of filteredCanonicalReviews) {
      const key = `${review.cycle?.id || "no-cycle"}::${review.user?.department || "Unknown"}`
      const current = grouped.get(key) || []
      current.push(review)
      grouped.set(key, current)
    }
    return Array.from(grouped.entries()).map(([key, rows]) => {
      const [cycleId, department] = key.split("::")
      const avg = (pick: (review: ReviewRow) => number | null) => {
        const values = rows
          .filter((review) => isSubmittedReview(review))
          .map(pick)
          .filter((value): value is number => value !== null)
        if (values.length === 0) return "-"
        return formatMetric(values.reduce((sum, value) => sum + value, 0) / values.length)
      }
      const submitted = rows.filter((review) => isSubmittedReview(review)).length
      return {
        cycleId,
        cycle: rows[0]?.cycle?.name || "Performance Review",
        department,
        reviews: rows.length,
        submitted,
        kpi: avg((review) => review.kpi_score),
        cbt: avg((review) => review.cbt_score),
        attendance: avg((review) => review.attendance_score),
        behaviour: avg((review) => review.behaviour_score),
        final: avg((review) => review.final_score),
      }
    })
  }, [filteredCanonicalReviews])

  const cycleRows = useMemo(() => {
    const grouped = new Map<string, ReviewRow[]>()
    for (const review of filteredCanonicalReviews) {
      const key = review.cycle?.id || "no-cycle"
      const current = grouped.get(key) || []
      current.push(review)
      grouped.set(key, current)
    }
    return Array.from(grouped.entries()).map(([cycleId, rows]) => ({
      cycleId,
      cycle: rows[0]?.cycle?.name || "Performance Review",
      review_type: rows[0]?.cycle?.review_type || "-",
      reviews: rows.length,
      submitted: rows.filter((review) => isSubmittedReview(review)).length,
      departments: new Set(rows.map((review) => review.user?.department).filter(Boolean)).size,
      completed: rows.filter((review) => String(review.status || "").toLowerCase() === "completed").length,
    }))
  }, [filteredCanonicalReviews])

  const exportRows = useMemo(() => {
    if (tab === "individual") {
      return filteredCanonicalReviews.map((review, index) => ({
        "S/N": index + 1,
        Employee: `${review.user?.first_name || ""} ${review.user?.last_name || ""}`.trim() || "Employee",
        Department: review.user?.department || "-",
        Quarter: review.cycle?.name || "-",
        KPI: formatMetric(review.kpi_score),
        CBT: formatMetric(review.cbt_score),
        Attendance: formatMetric(review.attendance_score),
        Behaviour: formatMetric(review.behaviour_score),
        Final: formatMetric(review.final_score),
      }))
    }
    if (tab === "department") {
      return departmentRows.map((row, index) => ({
        "S/N": index + 1,
        Department: row.department,
        Quarter: row.cycle,
        Reviews: row.reviews,
        Submitted: row.submitted,
        KPI: row.kpi,
        CBT: row.cbt,
        Attendance: row.attendance,
        Behaviour: row.behaviour,
        Final: row.final,
      }))
    }
    return cycleRows.map((row, index) => ({
      "S/N": index + 1,
      Quarter: row.cycle,
      "Review Type": row.review_type,
      "Employee Count": row.reviews,
      Submitted: row.submitted,
      Departments: row.departments,
      Completed: row.completed,
    }))
  }, [cycleRows, departmentRows, filteredCanonicalReviews, tab])

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="PMS Reviews"
        description="Manage quarterly reviews by individual, department, or cycle."
        icon={FileText}
        backLink={{ href: "/admin/hr/pms", label: "Back to PMS" }}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setIsExportOpen(true)}
              disabled={exportRows.length === 0}
              className="h-8 gap-2"
              size="sm"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button onClick={() => setIsCreateReviewOpen(true)} className="h-8 gap-2" size="sm">
              <Plus className="h-4 w-4" />
              Add Review
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabMode)} className="mb-4">
        <TabsList>
          <TabsTrigger value="individual">Individual</TabsTrigger>
          <TabsTrigger value="department">Department</TabsTrigger>
          <TabsTrigger value="cycle">Cycle</TabsTrigger>
          <TabsTrigger value="calibration">Calibration</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Rows</p>
            <p className="text-2xl font-semibold">
              {tab === "individual"
                ? filteredCanonicalReviews.length
                : tab === "department"
                  ? departmentRows.length
                  : cycleRows.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Submitted</p>
            <p className="text-2xl font-semibold">
              {tab === "individual"
                ? filteredCanonicalReviews.filter((review) =>
                    ["submitted", "completed"].includes(String(review.status || "").toLowerCase())
                  ).length
                : tab === "department"
                  ? departmentRows.reduce((sum, row) => sum + row.submitted, 0)
                  : cycleRows.reduce((sum, row) => sum + row.submitted, 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Cycle</p>
            <p className="text-lg font-semibold">{quarterFilter === "all" ? "All Quarters" : quarterFilter}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4 border-2">
        <CardContent className="p-3 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
              <Input
                placeholder="Search quarter, department, or employee..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-10"
              />
            </div>
            {tab === "individual" || tab === "cycle" ? (
              <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue placeholder="Employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {canonicalReviews.map((review) => (
                    <SelectItem key={review.user?.id || review.id} value={review.user?.id || ""}>
                      {`${review.user?.first_name || ""} ${review.user?.last_name || ""}`.trim() || "Employee"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full md:w-56">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departmentOptions.map((department) => (
                  <SelectItem key={department} value={department}>
                    {department}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={quarterFilter} onValueChange={setQuarterFilter}>
              <SelectTrigger className="w-full md:w-72">
                <SelectValue placeholder="Quarter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Quarters</SelectItem>
                {quarterOptions.map((quarter) => (
                  <SelectItem key={quarter} value={quarter}>
                    {quarter}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>
              {tab === "individual"
                ? "Individual Reviews"
                : tab === "department"
                  ? "Department Reviews"
                  : "Cycle Reviews"}
            </CardTitle>
            {isRefreshing ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Refreshing...
              </div>
            ) : null}
          </div>
          <CardDescription>
            {tab === "individual"
              ? "Edit employee reviews directly from the current cycle table."
              : tab === "department"
                ? "Open a department inside a quarter to work on that team."
                : "Open a cycle to review all employees in that quarter."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isInitialLoading && reviews.length === 0 ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading review table...
            </div>
          ) : error ? (
            <div className="space-y-3 py-4">
              <p className="text-sm text-red-500">{error}</p>
              <Button variant="outline" onClick={() => void loadReviews()}>
                Retry
              </Button>
            </div>
          ) : tab === "calibration" ? (
            <CalibrationView reviews={filteredCanonicalReviews} />
          ) : tab === "individual" ? (
            <div className="overflow-x-auto">
              <Table className="min-w-[1150px]">
                <TableHeader className="bg-emerald-50 dark:bg-emerald-950/30">
                  <TableRow>
                    <TableHead className="w-16">S/N</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Quarter</TableHead>
                    <TableHead>KPI</TableHead>
                    <TableHead>CBT</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead>Behaviour</TableHead>
                    <TableHead>Final</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCanonicalReviews.map((review, index) => (
                    <TableRow key={review.id}>
                      <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        {`${review.user?.first_name || ""} ${review.user?.last_name || ""}`.trim() || "Employee"}
                      </TableCell>
                      <TableCell>{review.user?.department || "-"}</TableCell>
                      <TableCell>{review.cycle?.name || "-"}</TableCell>
                      <TableCell>{formatMetric(review.kpi_score)}</TableCell>
                      <TableCell>{formatMetric(review.cbt_score)}</TableCell>
                      <TableCell>{formatMetric(review.attendance_score)}</TableCell>
                      <TableCell>{formatMetric(review.behaviour_score)}</TableCell>
                      <TableCell>{formatMetric(review.final_score)}</TableCell>
                      <TableCell className="text-right">
                        {review.review_cycle_id ? (
                          <Link
                            href={`/admin/hr/pms/reviews/${encodeURIComponent(review.review_cycle_id)}?mode=individual`}
                          >
                            <Button size="sm" variant="outline">
                              Edit
                            </Button>
                          </Link>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : tab === "department" ? (
            <div className="overflow-x-auto">
              <Table className="min-w-[1100px]">
                <TableHeader className="bg-emerald-50 dark:bg-emerald-950/30">
                  <TableRow>
                    <TableHead className="w-16">S/N</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Quarter</TableHead>
                    <TableHead>Reviews</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>KPI</TableHead>
                    <TableHead>CBT</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead>Behaviour</TableHead>
                    <TableHead>Final</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departmentRows.map((row, index) => (
                    <TableRow key={`${row.cycleId}-${row.department}`}>
                      <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                      <TableCell className="font-medium">{row.department}</TableCell>
                      <TableCell>{row.cycle}</TableCell>
                      <TableCell>{row.reviews}</TableCell>
                      <TableCell>{row.submitted}</TableCell>
                      <TableCell>{row.kpi}</TableCell>
                      <TableCell>{row.cbt}</TableCell>
                      <TableCell>{row.attendance}</TableCell>
                      <TableCell>{row.behaviour}</TableCell>
                      <TableCell>{row.final}</TableCell>
                      <TableCell className="text-right">
                        {row.cycleId !== "no-cycle" ? (
                          <Link
                            href={`/admin/hr/pms/reviews/${encodeURIComponent(row.cycleId)}?mode=department&department=${encodeURIComponent(row.department)}`}
                          >
                            <Button size="sm" variant="outline">
                              Edit
                            </Button>
                          </Link>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[980px]">
                <TableHeader className="bg-emerald-50 dark:bg-emerald-950/30">
                  <TableRow>
                    <TableHead className="w-16">S/N</TableHead>
                    <TableHead>Quarter</TableHead>
                    <TableHead>Review Type</TableHead>
                    <TableHead>Employee Count</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Departments</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cycleRows.map((row, index) => (
                    <TableRow key={row.cycleId}>
                      <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                      <TableCell className="font-medium">{row.cycle}</TableCell>
                      <TableCell>{row.review_type}</TableCell>
                      <TableCell>{row.reviews}</TableCell>
                      <TableCell>{row.submitted}</TableCell>
                      <TableCell>{row.departments}</TableCell>
                      <TableCell>{row.completed}</TableCell>
                      <TableCell className="text-right">
                        {row.cycleId !== "no-cycle" ? (
                          <Link href={`/admin/hr/pms/reviews/${encodeURIComponent(row.cycleId)}?mode=individual`}>
                            <Button size="sm" variant="outline">
                              Edit
                            </Button>
                          </Link>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {tab === "individual" && totalReviews > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalReviews)} of {totalReviews}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 0 || isRefreshing}
                  onClick={() => void loadReviews(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={(page + 1) * PAGE_SIZE >= totalReviews || isRefreshing}
                  onClick={() => void loadReviews(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateReviewDialog
        open={isCreateReviewOpen}
        onOpenChange={setIsCreateReviewOpen}
        queryClient={queryClient}
        mode={tab === "department" ? "department" : "individual"}
        onSaved={() => {
          void loadReviews()
        }}
      />
      <ExportOptionsDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        title="Export PMS Reviews"
        options={[
          { id: "excel", label: "Excel (.xlsx)", icon: "excel" },
          { id: "pdf", label: "PDF", icon: "pdf" },
        ]}
        onSelect={(id) => {
          const filename = `pms-reviews-${tab}-${new Date().toISOString().slice(0, 10)}`
          if (id === "excel") {
            void exportPmsRowsToExcel(exportRows, filename)
            return
          }
          void exportPmsRowsToPdf(exportRows, filename, "PMS Reviews")
        }}
      />
    </PageWrapper>
  )
}
