"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Download, FileText, Loader2, Plus, Search } from "lucide-react"
import { toast } from "sonner"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CreateReviewDialog } from "../../../performance/_components/create-review-dialog"
import { ExportOptionsDialog } from "@/components/admin/export-options-dialog"
import { exportPmsRowsToExcel, exportPmsRowsToPdf } from "@/lib/pms/export"

type ReviewRow = {
  id: string
  created_at: string
  status: "draft" | "submitted" | "completed" | null
  user_id: string | null
  review_cycle_id: string | null
  kpi_score: number | null
  cbt_score: number | null
  attendance_score: number | null
  behaviour_score: number | null
  final_score: number | null
  strengths: string | null
  areas_for_improvement: string | null
  manager_comments: string | null
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

type TabMode = "individual" | "department" | "cycle"

function reviewStatusPriority(status: string | null | undefined) {
  const normalized = String(status || "").toLowerCase()
  if (normalized === "completed") return 3
  if (normalized === "submitted") return 2
  if (normalized === "draft") return 1
  return 0
}

function pickCanonicalReview(rows: ReviewRow[]) {
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

function canMarkReviewCompleted(review: ReviewRow) {
  return [review.kpi_score, review.cbt_score, review.attendance_score, review.behaviour_score].every(
    (value) => typeof value === "number" && Number.isFinite(value) && value > 0
  )
}

export default function AdminPmsQuarterReviewsPage() {
  const params = useParams<{ cycleId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  const cycleId = String(params.cycleId || "")
  const mode = ((searchParams.get("mode") as TabMode) || "individual") as TabMode
  const selectedDepartment = searchParams.get("department") || "all"

  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTarget, setEditingTarget] = useState<ReviewRow | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState(selectedDepartment)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [updatingStatusId, setUpdatingStatusId] = useState("")
  const hasLoadedReviewsRef = useRef(false)

  const loadReviews = useCallback(async () => {
    if (hasLoadedReviewsRef.current) {
      setIsRefreshing(true)
    } else {
      setIsInitialLoading(true)
    }
    setError(null)
    try {
      const response = await fetch(`/api/hr/performance/reviews?cycle_id=${encodeURIComponent(cycleId)}`, {
        cache: "no-store",
      })
      const payload = (await response.json().catch(() => null)) as ReviewsApiPayload | null
      if (!response.ok) throw new Error(payload?.error || "Failed to load quarter reviews")
      setReviews(payload?.data || [])
      hasLoadedReviewsRef.current = true
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load quarter reviews")
    } finally {
      setIsInitialLoading(false)
      setIsRefreshing(false)
    }
  }, [cycleId])

  useEffect(() => {
    if (!cycleId) return
    void loadReviews()
  }, [cycleId, loadReviews])

  useEffect(() => {
    setDepartmentFilter(selectedDepartment)
  }, [selectedDepartment])

  const canonicalReviews = useMemo(() => {
    const groupedByUser = new Map<string, ReviewRow[]>()
    for (const review of reviews) {
      const userKey = review.user_id || review.id
      const existing = groupedByUser.get(userKey) || []
      existing.push(review)
      groupedByUser.set(userKey, existing)
    }

    return Array.from(groupedByUser.values())
      .map((entries) => pickCanonicalReview(entries))
      .sort((a, b) => {
        const leftName = `${a.user?.first_name || ""} ${a.user?.last_name || ""}`.trim().toLowerCase()
        const rightName = `${b.user?.first_name || ""} ${b.user?.last_name || ""}`.trim().toLowerCase()
        return leftName.localeCompare(rightName)
      })
  }, [reviews])

  const cycleName = canonicalReviews[0]?.cycle?.name || reviews[0]?.cycle?.name || "Quarter Review"
  const availableDepartments = useMemo(
    () =>
      Array.from(new Set(canonicalReviews.map((review) => review.user?.department).filter(Boolean) as string[])).sort(),
    [canonicalReviews]
  )

  const filteredIndividualRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return canonicalReviews.filter((review) => {
      const fullName = `${review.user?.first_name || ""} ${review.user?.last_name || ""}`.trim().toLowerCase()
      const department = String(review.user?.department || "-").toLowerCase()
      const status = String(review.status || "draft").toLowerCase()
      const matchesQuery =
        query.length === 0 || fullName.includes(query) || department.includes(query) || status.includes(query)
      const matchesDepartment = departmentFilter === "all" || review.user?.department === departmentFilter
      const matchesStatus = statusFilter === "all" || status === statusFilter
      return matchesQuery && matchesDepartment && matchesStatus
    })
  }, [canonicalReviews, departmentFilter, searchTerm, statusFilter])

  const departmentRows = useMemo(() => {
    const grouped = new Map<string, ReviewRow[]>()
    for (const review of canonicalReviews) {
      const department = review.user?.department || "Unknown"
      const existing = grouped.get(department) || []
      existing.push(review)
      grouped.set(department, existing)
    }

    return Array.from(grouped.entries())
      .map(([department, rows]) => ({
        department,
        reviews: rows.length,
        submitted: rows.filter((review) => isSubmittedReview(review)).length,
        completed: rows.filter((review) => review.status === "completed").length,
        kpi: (() => {
          const values = rows
            .filter((review) => isSubmittedReview(review))
            .map((review) => review.kpi_score)
            .filter((value): value is number => value !== null)
          return values.length > 0 ? formatMetric(values.reduce((sum, value) => sum + value, 0) / values.length) : "-"
        })(),
        cbt: (() => {
          const values = rows
            .filter((review) => isSubmittedReview(review))
            .map((review) => review.cbt_score)
            .filter((value): value is number => value !== null)
          return values.length > 0 ? formatMetric(values.reduce((sum, value) => sum + value, 0) / values.length) : "-"
        })(),
        attendance: (() => {
          const values = rows
            .filter((review) => isSubmittedReview(review))
            .map((review) => review.attendance_score)
            .filter((value): value is number => value !== null)
          return values.length > 0 ? formatMetric(values.reduce((sum, value) => sum + value, 0) / values.length) : "-"
        })(),
        behaviour: (() => {
          const values = rows
            .filter((review) => isSubmittedReview(review))
            .map((review) => review.behaviour_score)
            .filter((value): value is number => value !== null)
          return values.length > 0 ? formatMetric(values.reduce((sum, value) => sum + value, 0) / values.length) : "-"
        })(),
        final: (() => {
          const values = rows
            .filter((review) => isSubmittedReview(review))
            .map((review) => review.final_score)
            .filter((value): value is number => value !== null)
          return values.length > 0 ? formatMetric(values.reduce((sum, value) => sum + value, 0) / values.length) : "-"
        })(),
      }))
      .filter((row) => {
        const query = searchTerm.trim().toLowerCase()
        const matchesQuery = query.length === 0 || row.department.toLowerCase().includes(query)
        const matchesDepartment = departmentFilter === "all" || row.department === departmentFilter
        return matchesQuery && matchesDepartment
      })
  }, [canonicalReviews, departmentFilter, searchTerm])

  const cycleRows = useMemo(
    () => [
      {
        cycle: cycleName,
        review_type: canonicalReviews[0]?.cycle?.review_type || reviews[0]?.cycle?.review_type || "-",
        employee_count: canonicalReviews.length,
        submitted: canonicalReviews.filter((review) => isSubmittedReview(review)).length,
        departments: availableDepartments.length,
        completed: canonicalReviews.filter((review) => review.status === "completed").length,
      },
    ],
    [availableDepartments.length, canonicalReviews, cycleName, reviews]
  )

  const exportRows =
    mode === "individual"
      ? filteredIndividualRows.map((review, index) => ({
          "S/N": index + 1,
          Employee: `${review.user?.first_name || ""} ${review.user?.last_name || ""}`.trim() || "Employee",
          Department: review.user?.department || "-",
          KPI: formatMetric(review.kpi_score),
          CBT: formatMetric(review.cbt_score),
          Attendance: formatMetric(review.attendance_score),
          Behaviour: formatMetric(review.behaviour_score),
          Final: formatMetric(review.final_score),
          Status: String(review.status || "draft"),
        }))
      : mode === "department"
        ? departmentRows.map((row, index) => ({
            "S/N": index + 1,
            Department: row.department,
            Reviews: row.reviews,
            Submitted: row.submitted,
            KPI: row.kpi,
            CBT: row.cbt,
            Attendance: row.attendance,
            Behaviour: row.behaviour,
            Final: row.final,
            Completed: row.completed,
          }))
        : cycleRows.map((row, index) => ({
            "S/N": index + 1,
            Quarter: row.cycle,
            "Review Type": row.review_type,
            "Employee Count": row.employee_count,
            Submitted: row.submitted,
            Departments: row.departments,
            Completed: row.completed,
          }))

  async function handleStatusUpdate(reviewId: string, status: "draft" | "submitted" | "completed") {
    const targetReview = filteredIndividualRows.find((review) => review.id === reviewId)
    setUpdatingStatusId(reviewId)
    try {
      const response = await fetch("/api/hr/performance/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: reviewId,
          user_id: targetReview?.user_id || undefined,
          review_cycle_id: targetReview?.review_cycle_id || cycleId,
          status,
        }),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || "Failed to update review status")
      toast.success("Review status updated")
      await loadReviews()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update review status")
    } finally {
      setUpdatingStatusId("")
    }
  }

  function handleTabChange(nextMode: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("mode", nextMode)
    if (nextMode !== "department") {
      params.delete("department")
    } else if (departmentFilter !== "all") {
      params.set("department", departmentFilter)
    }
    router.replace(`/admin/hr/pms/reviews/${encodeURIComponent(cycleId)}?${params.toString()}`)
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title={cycleName}
        description="Review and edit employee records for this quarter."
        icon={FileText}
        backLink={{ href: "/admin/hr/pms/reviews", label: "Back to PMS Reviews" }}
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
            <Button
              onClick={() => {
                setEditingTarget(null)
                setIsDialogOpen(true)
              }}
              className="h-8 gap-2"
              size="sm"
            >
              <Plus className="h-4 w-4" />
              Add Review
            </Button>
          </div>
        }
      />

      <div className="mb-4">
        <Link
          href="/admin/hr/pms/reviews"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to quarterly table
        </Link>
      </div>

      <Tabs value={mode} onValueChange={handleTabChange} className="mb-4">
        <TabsList>
          <TabsTrigger value="individual">Individual</TabsTrigger>
          <TabsTrigger value="department">Department</TabsTrigger>
          <TabsTrigger value="cycle">Cycle</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="mb-4 border-2">
        <CardContent className="p-3 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
              <Input
                placeholder="Search employee, department or status..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-10"
              />
            </div>
            {mode !== "cycle" ? (
              <Select
                value={departmentFilter}
                onValueChange={(value) => {
                  setDepartmentFilter(value)
                  if (mode === "department") {
                    const params = new URLSearchParams(searchParams.toString())
                    params.set("mode", "department")
                    if (value === "all") params.delete("department")
                    else params.set("department", value)
                    router.replace(`/admin/hr/pms/reviews/${encodeURIComponent(cycleId)}?${params.toString()}`)
                  }
                }}
              >
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {availableDepartments.map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {mode === "individual" ? (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>
              {mode === "individual"
                ? "Quarter Review Entries"
                : mode === "department"
                  ? "Department Summary"
                  : "Cycle Summary"}
            </CardTitle>
            {isRefreshing ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Refreshing...
              </div>
            ) : null}
          </div>
          <CardDescription>
            {mode === "individual"
              ? "Edit a user review and update its status for this cycle."
              : mode === "department"
                ? "Open a department by switching to the individual tab with that department filter."
                : "Quarter-wide summary for this cycle."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isInitialLoading && reviews.length === 0 ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading quarter records...
            </div>
          ) : error ? (
            <div className="space-y-3 py-4">
              <p className="text-sm text-red-500">{error}</p>
              <Button variant="outline" onClick={() => void loadReviews()}>
                Retry
              </Button>
            </div>
          ) : mode === "individual" ? (
            <Table className="min-w-[1180px]">
              <TableHeader className="bg-emerald-50 dark:bg-emerald-950/30">
                <TableRow>
                  <TableHead className="w-16">S/N</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>KPI</TableHead>
                  <TableHead>CBT</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead>Behaviour</TableHead>
                  <TableHead>Final</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIndividualRows.map((review, index) => (
                  <TableRow key={review.id}>
                    <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                    <TableCell className="font-medium">
                      {`${review.user?.first_name || ""} ${review.user?.last_name || ""}`.trim() || "Employee"}
                    </TableCell>
                    <TableCell>{review.user?.department || "-"}</TableCell>
                    <TableCell>{formatMetric(review.kpi_score)}</TableCell>
                    <TableCell>{formatMetric(review.cbt_score)}</TableCell>
                    <TableCell>{formatMetric(review.attendance_score)}</TableCell>
                    <TableCell>{formatMetric(review.behaviour_score)}</TableCell>
                    <TableCell>{formatMetric(review.final_score)}</TableCell>
                    <TableCell className="capitalize">{String(review.status || "draft")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingTarget(review)
                            setIsDialogOpen(true)
                          }}
                        >
                          Edit
                        </Button>
                        {review.status !== "completed" ? (
                          <Button
                            size="sm"
                            onClick={() => void handleStatusUpdate(review.id, "completed")}
                            loading={updatingStatusId === review.id}
                            disabled={!canMarkReviewCompleted(review)}
                            title={
                              !canMarkReviewCompleted(review)
                                ? "Add KPI, CBT, Attendance, and Behaviour before completing this review."
                                : undefined
                            }
                          >
                            Mark Completed
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleStatusUpdate(review.id, "draft")}
                            loading={updatingStatusId === review.id}
                          >
                            Reopen Draft
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : mode === "department" ? (
            <Table className="min-w-[1080px]">
              <TableHeader className="bg-emerald-50 dark:bg-emerald-950/30">
                <TableRow>
                  <TableHead className="w-16">S/N</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Reviews</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>KPI</TableHead>
                  <TableHead>CBT</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead>Behaviour</TableHead>
                  <TableHead>Final</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departmentRows.map((row, index) => (
                  <TableRow key={row.department}>
                    <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                    <TableCell className="font-medium">{row.department}</TableCell>
                    <TableCell>{row.reviews}</TableCell>
                    <TableCell>{row.submitted}</TableCell>
                    <TableCell>{row.kpi}</TableCell>
                    <TableCell>{row.cbt}</TableCell>
                    <TableCell>{row.attendance}</TableCell>
                    <TableCell>{row.behaviour}</TableCell>
                    <TableCell>{row.final}</TableCell>
                    <TableCell>{row.completed}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const params = new URLSearchParams(searchParams.toString())
                          params.set("mode", "individual")
                          params.set("department", row.department)
                          router.replace(`/admin/hr/pms/reviews/${encodeURIComponent(cycleId)}?${params.toString()}`)
                        }}
                      >
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table className="min-w-[900px]">
              <TableHeader className="bg-emerald-50 dark:bg-emerald-950/30">
                <TableRow>
                  <TableHead className="w-16">S/N</TableHead>
                  <TableHead>Quarter</TableHead>
                  <TableHead>Review Type</TableHead>
                  <TableHead>Employee Count</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Departments</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cycleRows.map((row, index) => (
                  <TableRow key={row.cycle}>
                    <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                    <TableCell className="font-medium">{row.cycle}</TableCell>
                    <TableCell>{row.review_type}</TableCell>
                    <TableCell>{row.employee_count}</TableCell>
                    <TableCell>{row.submitted}</TableCell>
                    <TableCell>{row.departments}</TableCell>
                    <TableCell>{row.completed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateReviewDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        queryClient={queryClient}
        mode={mode === "department" ? "department" : "individual"}
        initialUserId={editingTarget?.user_id || ""}
        initialCycleId={cycleId}
        initialDepartment={editingTarget?.user?.department || (departmentFilter !== "all" ? departmentFilter : "")}
        initialStatus={editingTarget?.status || "draft"}
        onSaved={() => {
          void loadReviews()
        }}
      />
      <ExportOptionsDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        title={`Export ${cycleName}`}
        options={[
          { id: "excel", label: "Excel (.xlsx)", icon: "excel" },
          { id: "pdf", label: "PDF", icon: "pdf" },
        ]}
        onSelect={(id) => {
          const filename = `${cycleName.replace(/\s+/g, "-").toLowerCase()}-reviews-${new Date().toISOString().slice(0, 10)}`
          if (id === "excel") {
            void exportPmsRowsToExcel(exportRows, filename)
            return
          }
          void exportPmsRowsToPdf(exportRows, filename, cycleName)
        }}
      />
    </PageWrapper>
  )
}
