"use client"

import { Fragment, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, ChevronDown, ChevronRight, FileText, Star } from "lucide-react"
import Link from "next/link"
import type { Review } from "./page"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ReviewsContentProps {
  initialReviews: Review[]
  currentUserId: string
}

export function ReviewsContent({ initialReviews, currentUserId }: ReviewsContentProps) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews)
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [employeeComments, setEmployeeComments] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedQuarters, setExpandedQuarters] = useState<Record<string, boolean>>({})

  function renderStars(rating: number) {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-5 w-5 ${star <= rating ? "fill-yellow-500 text-yellow-500" : "text-gray-300"}`}
          />
        ))}
      </div>
    )
  }

  function getStatusBadge(status: string) {
    const colors: { [key: string]: string } = {
      draft: "bg-gray-100 text-gray-800",
      submitted: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
    }
    return colors[status] || "bg-gray-100 text-gray-800"
  }

  function isCbtOnlyDraftEntry(review: Review) {
    return (
      review.status === "draft" &&
      review.reviewer_id === currentUserId &&
      review.cbt_score != null &&
      review.kpi_score == null &&
      review.attendance_score == null &&
      review.behaviour_score == null &&
      !review.manager_comments &&
      !review.strengths &&
      !review.areas_for_improvement
    )
  }

  const visibleReviews = reviews.filter((review) => !isCbtOnlyDraftEntry(review))

  function normalizeMetric(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined) return null
    const normalized = typeof value === "number" ? value : Number(value)
    return Number.isFinite(normalized) ? normalized : null
  }

  function formatMetric(value: number | string | null | undefined): string {
    const normalized = normalizeMetric(value)
    return normalized === null ? "-" : `${normalized.toFixed(2).replace(/\.00$/, "")}`
  }

  const averageFinalScore = (() => {
    const finals = visibleReviews
      .map((review) => normalizeMetric(review.final_score))
      .filter((value): value is number => value !== null)
    if (finals.length === 0) return null
    return finals.reduce((sum, value) => sum + value, 0) / finals.length
  })()

  function getQuarterLabel(review: Review) {
    if (review.review_cycle?.name) return review.review_cycle.name
    const date = new Date(review.created_at)
    const quarter = Math.floor(date.getMonth() / 3) + 1
    return `Q${quarter} ${date.getFullYear()}`
  }

  function averageMetric(values: Array<number | string | null | undefined>) {
    const valid = values.map((value) => normalizeMetric(value)).filter((value): value is number => value !== null)
    if (valid.length === 0) return "-"
    const avg = valid.reduce((sum, value) => sum + value, 0) / valid.length
    return formatMetric(avg)
  }

  function reviewerLabel(review: Review) {
    if (review.reviewer_id === currentUserId) return "You"
    const fullName = `${review.reviewer?.first_name || ""} ${review.reviewer?.last_name || ""}`.trim()
    return fullName || "System"
  }

  const quarterGroups = useMemo(() => {
    const grouped = new Map<string, Review[]>()
    for (const review of visibleReviews) {
      const label = getQuarterLabel(review)
      const existing = grouped.get(label) || []
      existing.push(review)
      grouped.set(label, existing)
    }
    return Array.from(grouped.entries()).map(([quarter, quarterReviews]) => ({
      quarter,
      reviews: quarterReviews.sort(
        (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      ),
    }))
  }, [visibleReviews])

  function toggleQuarter(quarter: string) {
    setExpandedQuarters((current) => ({
      ...current,
      [quarter]: !current[quarter],
    }))
  }

  async function acknowledgeReview() {
    if (!selectedReview) return

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/hr/performance/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedReview.id,
          acknowledge: true,
          employee_comments: employeeComments || null,
        }),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string; data?: Review } | null
      if (!response.ok || !payload?.data) throw new Error(payload?.error || "Failed to acknowledge review")

      setReviews((currentReviews) =>
        currentReviews.map((review) =>
          review.id === selectedReview.id
            ? { ...review, ...payload.data, employee_comments: employeeComments || null }
            : review
        )
      )
      toast.success("Review acknowledged")
      setSelectedReview(null)
      setEmployeeComments("")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to acknowledge review"
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Link href="/profile" className="text-muted-foreground hover:text-foreground flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Performance Reviews</h1>
          <p className="text-muted-foreground">View your performance evaluations</p>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 md:gap-4">
        <Card>
          <CardHeader className="px-3 pt-3 pb-1 sm:px-6 sm:pt-6 sm:pb-2">
            <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold sm:text-2xl">{visibleReviews.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="px-3 pt-3 pb-1 sm:px-6 sm:pt-6 sm:pb-2">
            <CardTitle className="text-sm font-medium">Average Final Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold sm:text-2xl">
                {averageFinalScore == null ? "-" : formatMetric(averageFinalScore)}
              </span>
              <span className="text-muted-foreground text-sm">/100</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="px-3 pt-3 pb-1 sm:px-6 sm:pt-6 sm:pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-green-600 sm:text-2xl">
              {visibleReviews.filter((review) => review.status === "completed").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reviews Table */}
      {quarterGroups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <h3 className="text-lg font-semibold">No reviews yet</h3>
            <p className="text-muted-foreground">Your performance reviews will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Quarterly Reviews</CardTitle>
            <CardDescription>Expand a quarter to view strengths, improvement areas, and comments.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-3 py-2 font-medium">Quarter</th>
                    <th className="px-3 py-2 font-medium">Reviewed By</th>
                    <th className="px-3 py-2 font-medium">Reviews</th>
                    <th className="px-3 py-2 font-medium">KPI</th>
                    <th className="px-3 py-2 font-medium">CBT</th>
                    <th className="px-3 py-2 font-medium">Attendance</th>
                    <th className="px-3 py-2 font-medium">Behaviour</th>
                    <th className="px-3 py-2 font-medium">Final</th>
                    <th className="px-3 py-2 font-medium">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {quarterGroups.map((group) => {
                    const isExpanded = Boolean(expandedQuarters[group.quarter])
                    return (
                      <Fragment key={group.quarter}>
                        <tr key={`${group.quarter}-summary`} className="border-b">
                          <td className="px-3 py-2">
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-auto px-0 py-0 font-semibold hover:bg-transparent hover:text-inherit"
                              onClick={() => toggleQuarter(group.quarter)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="mr-2 h-4 w-4" />
                              ) : (
                                <ChevronRight className="mr-2 h-4 w-4" />
                              )}
                              {group.quarter}
                            </Button>
                          </td>
                          <td className="px-3 py-2">
                            {Array.from(new Set(group.reviews.map((review) => reviewerLabel(review)))).join(", ")}
                          </td>
                          <td className="px-3 py-2">{group.reviews.length}</td>
                          <td className="px-3 py-2">
                            {averageMetric(group.reviews.map((review) => review.kpi_score))}
                          </td>
                          <td className="px-3 py-2">
                            {averageMetric(group.reviews.map((review) => review.cbt_score))}
                          </td>
                          <td className="px-3 py-2">
                            {averageMetric(group.reviews.map((review) => review.attendance_score))}
                          </td>
                          <td className="px-3 py-2">
                            {averageMetric(group.reviews.map((review) => review.behaviour_score))}
                          </td>
                          <td className="px-3 py-2">
                            {averageMetric(group.reviews.map((review) => review.final_score))}
                          </td>
                          <td className="px-3 py-2">
                            {group.reviews.filter((review) => review.status === "completed").length}
                          </td>
                        </tr>
                        {isExpanded ? (
                          <tr key={`${group.quarter}-details`} className="border-b">
                            <td colSpan={9} className="px-3 py-3">
                              <div className="space-y-3">
                                {group.reviews.map((review) => (
                                  <div key={review.id} className="bg-muted/20 space-y-3 rounded-lg border p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div>
                                        <p className="font-medium">
                                          {review.reviewer_id === currentUserId
                                            ? "Recorded by you"
                                            : `Reviewed by ${review.reviewer?.first_name} ${review.reviewer?.last_name}`}
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                          Review Date: {new Date(review.created_at).toLocaleDateString()}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge className={getStatusBadge(review.status || "draft")}>
                                          {review.status || "draft"}
                                        </Badge>
                                        {review.review_cycle?.review_type ? (
                                          <Badge variant="outline">{review.review_cycle.review_type}</Badge>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
                                      <div className="rounded border px-2 py-1">
                                        KPI: {formatMetric(review.kpi_score)}
                                      </div>
                                      <div className="rounded border px-2 py-1">
                                        CBT: {formatMetric(review.cbt_score)}
                                      </div>
                                      <div className="rounded border px-2 py-1">
                                        Attendance: {formatMetric(review.attendance_score)}
                                      </div>
                                      <div className="rounded border px-2 py-1">
                                        Behaviour: {formatMetric(review.behaviour_score)}
                                      </div>
                                      <div className="rounded border px-2 py-1">
                                        Final: {formatMetric(review.final_score)}
                                      </div>
                                    </div>

                                    <div className="space-y-2 overflow-x-auto">
                                      <p className="text-sm font-semibold">Review Details</p>
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="border-b text-left">
                                            <th className="text-muted-foreground w-16 px-2 py-2 font-medium">S/N</th>
                                            <th className="text-muted-foreground w-52 px-2 py-2 font-medium">Title</th>
                                            <th className="text-muted-foreground px-2 py-2 font-medium">Details</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          <tr className="border-b">
                                            <td className="px-2 py-2">1</td>
                                            <td className="text-muted-foreground px-2 py-2 font-medium">Strengths</td>
                                            <td className="px-2 py-2">{review.strengths || "-"}</td>
                                          </tr>
                                          <tr className="border-b">
                                            <td className="px-2 py-2">2</td>
                                            <td className="text-muted-foreground px-2 py-2 font-medium">
                                              Areas for Improvement
                                            </td>
                                            <td className="px-2 py-2">{review.areas_for_improvement || "-"}</td>
                                          </tr>
                                          <tr className="border-b">
                                            <td className="px-2 py-2">3</td>
                                            <td className="text-muted-foreground px-2 py-2 font-medium">
                                              Manager Comments
                                            </td>
                                            <td className="px-2 py-2">{review.manager_comments || "-"}</td>
                                          </tr>
                                          <tr>
                                            <td className="px-2 py-2">4</td>
                                            <td className="text-muted-foreground px-2 py-2 font-medium">
                                              Employee Comments
                                            </td>
                                            <td className="px-2 py-2">{review.employee_comments || "-"}</td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>

                                    {review.status === "completed" && !review.acknowledged_at ? (
                                      <Button
                                        onClick={() => {
                                          setSelectedReview(review)
                                          setEmployeeComments(review.employee_comments || "")
                                        }}
                                      >
                                        Acknowledge Review
                                      </Button>
                                    ) : null}

                                    {review.acknowledged_at ? (
                                      <Badge className="bg-green-100 text-green-800">
                                        Acknowledged on {new Date(review.acknowledged_at).toLocaleDateString()}
                                      </Badge>
                                    ) : null}

                                    {review.final_score == null ? (
                                      <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium">Overall Rating:</span>
                                        {renderStars(review.overall_rating || 0)}
                                        <span className="text-base font-bold">{review.overall_rating || 0}/5</span>
                                      </div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={Boolean(selectedReview)} onOpenChange={(open) => !open && setSelectedReview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Acknowledge Review</DialogTitle>
            <DialogDescription>Confirm that you have read this completed performance review.</DialogDescription>
          </DialogHeader>
          {selectedReview ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "KPI Achievement", value: selectedReview.kpi_score },
                  { label: "CBT", value: selectedReview.cbt_score },
                  { label: "Attendance", value: selectedReview.attendance_score },
                  { label: "Behaviour", value: selectedReview.behaviour_score },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border p-3">
                    <div className="text-muted-foreground text-xs">{item.label}</div>
                    <div className="mt-1 text-lg font-semibold">
                      {formatMetric(item.value)}
                      {normalizeMetric(item.value) != null ? "/100" : ""}
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Employee Comments</div>
                <Textarea
                  value={employeeComments}
                  onChange={(event) => setEmployeeComments(event.target.value)}
                  placeholder="Optional comments about this review"
                  rows={4}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedReview(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={acknowledgeReview} disabled={isSubmitting}>
              I acknowledge this review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
