"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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

type TabMode = "individual" | "department"

type SummaryRow = {
  cycleId: string
  cycleName: string
  department: string | null
  reviews: ReviewRow[]
}

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

function normalizeMetric(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function formatMetric(value: number | null | undefined) {
  const normalized = normalizeMetric(value)
  return normalized === null ? "-" : normalized.toFixed(2).replace(/\.00$/, "")
}

export default function AdminPmsReviewsPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<TabMode>("individual")
  const [isCreateReviewOpen, setIsCreateReviewOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [quarterFilter, setQuarterFilter] = useState("all")

  const loadReviews = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/hr/performance/reviews", { cache: "no-store" })
      const payload = (await response.json().catch(() => null)) as ReviewsApiPayload | null
      if (!response.ok) throw new Error(payload?.error || "Failed to load reviews")
      setReviews(payload?.data || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load reviews")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadReviews()
  }, [loadReviews])

  const summaryRows = useMemo(() => {
    const grouped = new Map<string, ReviewRow[]>()

    for (const review of reviews) {
      const cycleId = review.review_cycle_id || "no-cycle"
      const cycleName = review.cycle?.name || "Performance Review"
      const department = review.user?.department || "Unknown"
      const summaryKey = tab === "department" ? `${cycleId}::${department}` : cycleId
      const existing = grouped.get(summaryKey) || []
      existing.push(review)
      grouped.set(summaryKey, existing)
      void cycleName
    }

    const rows: SummaryRow[] = []
    grouped.forEach((group) => {
      const byUser = new Map<string, ReviewRow[]>()
      for (const review of group) {
        const userKey = review.user_id || review.id
        const existing = byUser.get(userKey) || []
        existing.push(review)
        byUser.set(userKey, existing)
      }
      const canonical = Array.from(byUser.values()).map((entries) => pickCanonicalReview(entries))
      const sample = canonical[0]
      rows.push({
        cycleId: sample?.review_cycle_id || "no-cycle",
        cycleName: sample?.cycle?.name || "Performance Review",
        department: tab === "department" ? sample?.user?.department || "Unknown" : null,
        reviews: canonical.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      })
    })

    return rows.sort((a, b) => {
      const aTime = new Date(a.reviews[0]?.created_at || 0).getTime()
      const bTime = new Date(b.reviews[0]?.created_at || 0).getTime()
      return bTime - aTime
    })
  }, [reviews, tab])

  const quarterOptions = useMemo(
    () => Array.from(new Set(summaryRows.map((row) => row.cycleName))).sort((a, b) => a.localeCompare(b)),
    [summaryRows]
  )

  const filteredSummaryRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return summaryRows.filter((row) => {
      const cycle = row.cycleName.toLowerCase()
      const department = String(row.department || "").toLowerCase()
      const matchesQuery =
        query.length === 0 ||
        cycle.includes(query) ||
        department.includes(query) ||
        row.reviews.some((review) =>
          `${review.user?.first_name || ""} ${review.user?.last_name || ""}`.trim().toLowerCase().includes(query)
        )
      const matchesQuarter = quarterFilter === "all" || row.cycleName === quarterFilter
      return matchesQuery && matchesQuarter
    })
  }, [summaryRows, searchQuery, quarterFilter])

  const handleExport = useCallback(() => {
    if (filteredSummaryRows.length === 0) return
    const header =
      tab === "department"
        ? "S/N,Quarter,Department,Reviews,KPI,CBT,Attendance,Behaviour,Final,Completed"
        : "S/N,Quarter,Reviews,KPI,CBT,Attendance,Behaviour,Final,Completed"

    const rows = filteredSummaryRows.map((row, index) => {
      const avg = (pick: (review: ReviewRow) => number | null) => {
        const values = row.reviews.map(pick).filter((value): value is number => value !== null)
        if (values.length === 0) return "-"
        const total = values.reduce((sum, value) => sum + value, 0)
        return formatMetric(total / values.length)
      }
      const values = [
        index + 1,
        row.cycleName,
        ...(tab === "department" ? [row.department || "-"] : []),
        row.reviews.length,
        avg((review) => normalizeMetric(review.kpi_score)),
        avg((review) => normalizeMetric(review.cbt_score)),
        avg((review) => normalizeMetric(review.attendance_score)),
        avg((review) => normalizeMetric(review.behaviour_score)),
        avg((review) => normalizeMetric(review.final_score)),
        row.reviews.filter((review) => String(review.status || "").toLowerCase() === "completed").length,
      ]
      return values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")
    })

    const csv = `${header}\n${rows.join("\n")}`
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `pms-reviews-${tab}-${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }, [filteredSummaryRows, tab])

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="PMS Reviews"
        description="Manage quarterly reviews by individual or by department."
        icon={FileText}
        backLink={{ href: "/admin/hr/pms", label: "Back to PMS" }}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={filteredSummaryRows.length === 0}
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
        </TabsList>
      </Tabs>

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
            <Select value={quarterFilter} onValueChange={setQuarterFilter}>
              <SelectTrigger className="w-full md:w-56">
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
          <CardTitle>{tab === "individual" ? "Quarterly Reviews" : "Quarterly Department Reviews"}</CardTitle>
          <CardDescription>
            {tab === "individual"
              ? "Open a quarter to edit users from a single table."
              : "Open a quarter and department to edit users from that department."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
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
          ) : filteredSummaryRows.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">No review entries yet.</p>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Showing {filteredSummaryRows.length} of {summaryRows.length} record(s).
              </p>
              <Table className="min-w-[1050px]">
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-16">S/N</TableHead>
                    <TableHead>Quarter</TableHead>
                    {tab === "department" ? <TableHead>Department</TableHead> : null}
                    <TableHead>Reviews</TableHead>
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
                  {filteredSummaryRows.map((row, index) => {
                    const avg = (pick: (review: ReviewRow) => number | null) => {
                      const values = row.reviews.map(pick).filter((value): value is number => value !== null)
                      if (values.length === 0) return "-"
                      const total = values.reduce((sum, value) => sum + value, 0)
                      return formatMetric(total / values.length)
                    }
                    const href = `/admin/hr/pms/reviews/${encodeURIComponent(row.cycleId)}?mode=${tab}${tab === "department" ? `&department=${encodeURIComponent(row.department || "")}` : ""}`

                    return (
                      <TableRow key={`${row.cycleId}-${row.department || "all"}`}>
                        <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                        <TableCell className="font-medium">{row.cycleName}</TableCell>
                        {tab === "department" ? <TableCell>{row.department || "-"}</TableCell> : null}
                        <TableCell>{row.reviews.length}</TableCell>
                        <TableCell>{avg((review) => normalizeMetric(review.kpi_score))}</TableCell>
                        <TableCell>{avg((review) => normalizeMetric(review.cbt_score))}</TableCell>
                        <TableCell>{avg((review) => normalizeMetric(review.attendance_score))}</TableCell>
                        <TableCell>{avg((review) => normalizeMetric(review.behaviour_score))}</TableCell>
                        <TableCell>{avg((review) => normalizeMetric(review.final_score))}</TableCell>
                        <TableCell>
                          {
                            row.reviews.filter((review) => String(review.status || "").toLowerCase() === "completed")
                              .length
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          {row.cycleId !== "no-cycle" ? (
                            <Link href={href}>
                              <Button size="sm" variant="outline">
                                Edit
                              </Button>
                            </Link>
                          ) : (
                            "-"
                          )}
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

      <CreateReviewDialog
        open={isCreateReviewOpen}
        onOpenChange={setIsCreateReviewOpen}
        queryClient={queryClient}
        mode={tab}
        onSaved={() => {
          void loadReviews()
        }}
      />
    </PageWrapper>
  )
}
