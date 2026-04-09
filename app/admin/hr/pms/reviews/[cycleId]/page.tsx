"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { ArrowLeft, Download, FileText, Loader2, Plus, Search } from "lucide-react"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CreateReviewDialog } from "../../../performance/_components/create-review-dialog"

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

type TabMode = "individual" | "department"

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

export default function AdminPmsQuarterReviewsPage() {
  const params = useParams<{ cycleId: string }>()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  const cycleId = String(params.cycleId || "")
  const mode = (searchParams.get("mode") === "department" ? "department" : "individual") as TabMode
  const selectedDepartment = searchParams.get("department")

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTarget, setEditingTarget] = useState<ReviewRow | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")

  const loadReviews = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/hr/performance/reviews?cycle_id=${encodeURIComponent(cycleId)}`, {
        cache: "no-store",
      })
      const payload = (await response.json().catch(() => null)) as ReviewsApiPayload | null
      if (!response.ok) throw new Error(payload?.error || "Failed to load quarter reviews")
      setReviews(payload?.data || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load quarter reviews")
    } finally {
      setLoading(false)
    }
  }, [cycleId])

  useEffect(() => {
    if (!cycleId) return
    void loadReviews()
  }, [cycleId, loadReviews])

  const scopedReviews = useMemo(() => {
    const filtered =
      mode === "department" && selectedDepartment
        ? reviews.filter((review) => (review.user?.department || "Unknown") === selectedDepartment)
        : reviews

    const groupedByUser = new Map<string, ReviewRow[]>()
    for (const review of filtered) {
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
  }, [reviews, mode, selectedDepartment])

  const cycleName = scopedReviews[0]?.cycle?.name || reviews[0]?.cycle?.name || "Quarter Review"
  const availableDepartments = useMemo(
    () =>
      Array.from(new Set(scopedReviews.map((review) => review.user?.department).filter(Boolean) as string[])).sort(),
    [scopedReviews]
  )

  const filteredReviews = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return scopedReviews.filter((review) => {
      const fullName = `${review.user?.first_name || ""} ${review.user?.last_name || ""}`.trim()
      const department = review.user?.department || "-"
      const status = String(review.status || "draft").toLowerCase()
      const matchesQuery =
        query.length === 0 ||
        fullName.toLowerCase().includes(query) ||
        department.toLowerCase().includes(query) ||
        status.includes(query)
      const matchesDepartment = departmentFilter === "all" || department === departmentFilter
      const matchesStatus = statusFilter === "all" || status === statusFilter
      return matchesQuery && matchesDepartment && matchesStatus
    })
  }, [scopedReviews, searchTerm, departmentFilter, statusFilter])

  const handleExport = useCallback(() => {
    if (filteredReviews.length === 0) return
    const rows = filteredReviews.map((review, index) => {
      const fullName = `${review.user?.first_name || ""} ${review.user?.last_name || ""}`.trim() || "Employee"
      return {
        sn: index + 1,
        employee: fullName,
        department: review.user?.department || "-",
        kpi: formatMetric(review.kpi_score),
        cbt: formatMetric(review.cbt_score),
        attendance: formatMetric(review.attendance_score),
        behaviour: formatMetric(review.behaviour_score),
        final: formatMetric(review.final_score),
        status: String(review.status || "draft"),
      }
    })
    const csvHeader = "S/N,Employee,Department,KPI,CBT,Attendance,Behaviour,Final,Status"
    const csvBody = rows
      .map((row) =>
        [row.sn, row.employee, row.department, row.kpi, row.cbt, row.attendance, row.behaviour, row.final, row.status]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n")
    const csv = `${csvHeader}\n${csvBody}`
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${cycleName.replace(/\s+/g, "-").toLowerCase()}-reviews.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }, [filteredReviews, cycleName])

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title={cycleName}
        description={
          mode === "department" && selectedDepartment
            ? `Review and edit ${selectedDepartment} records for this quarter.`
            : "Review and edit employee records for this quarter."
        }
        icon={FileText}
        backLink={{ href: "/admin/hr/pms/reviews", label: "Back to PMS Reviews" }}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={filteredReviews.length === 0}
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
          Back to Quarterly Table
        </Link>
      </div>

      <Card className="border-2">
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
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quarter Review Entries</CardTitle>
          <CardDescription>Use Edit to pre-load a user and update their review for this cycle.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
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
          ) : scopedReviews.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">No review entries found for this scope.</p>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Showing {filteredReviews.length} of {scopedReviews.length} record(s).
              </p>

              <Table className="min-w-[1050px]">
                <TableHeader className="bg-muted/50">
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
                  {filteredReviews.map((review, index) => (
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateReviewDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        queryClient={queryClient}
        mode={mode}
        initialUserId={editingTarget?.user_id || ""}
        initialCycleId={cycleId}
        initialDepartment={editingTarget?.user?.department || selectedDepartment || ""}
        onSaved={() => {
          void loadReviews()
        }}
      />
    </PageWrapper>
  )
}
