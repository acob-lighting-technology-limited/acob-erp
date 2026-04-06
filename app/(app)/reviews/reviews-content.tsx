"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Star, FileText, Target, BookOpen, CalendarCheck, Users } from "lucide-react"
import { Progress } from "@/components/ui/progress"
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
}

export function ReviewsContent({ initialReviews }: ReviewsContentProps) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews)
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [employeeComments, setEmployeeComments] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  const averageRating =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / reviews.length : 0

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
            <div className="text-lg font-bold sm:text-2xl">{reviews.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="px-3 pt-3 pb-1 sm:px-6 sm:pt-6 sm:pb-2">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold sm:text-2xl">{averageRating.toFixed(1)}</span>
              <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="px-3 pt-3 pb-1 sm:px-6 sm:pt-6 sm:pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-green-600 sm:text-2xl">
              {reviews.filter((r) => r.status === "completed").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <h3 className="text-lg font-semibold">No reviews yet</h3>
            <p className="text-muted-foreground">Your performance reviews will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{review.review_cycle?.name || "Performance Review"}</CardTitle>
                    <CardDescription>
                      Reviewed by {review.reviewer?.first_name} {review.reviewer?.last_name}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusBadge(review.status)}>{review.status}</Badge>
                    {review.review_cycle?.review_type && (
                      <Badge variant="outline">{review.review_cycle.review_type}</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* PMS 4-component score breakdown */}
                {review.final_score != null ? (
                  <div className="space-y-3 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Final Score</span>
                      <span
                        className={`text-2xl font-bold ${(review.final_score ?? 0) >= 70 ? "text-green-600" : (review.final_score ?? 0) >= 50 ? "text-yellow-600" : "text-red-600"}`}
                      >
                        {review.final_score} / 100
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        { label: "KPI Achievement", value: review.kpi_score, weight: 70, icon: Target },
                        { label: "CBT", value: review.cbt_score, weight: 10, icon: BookOpen },
                        { label: "Attendance", value: review.attendance_score, weight: 10, icon: CalendarCheck },
                        { label: "Behaviour", value: review.behaviour_score, weight: 10, icon: Users },
                      ].map(({ label, value, weight, icon: Icon }) => (
                        <div key={label} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1">
                              <Icon className="h-3.5 w-3.5" />
                              {label} <span className="text-muted-foreground">({weight}%)</span>
                            </span>
                            <span className="font-medium">
                              {value ?? "-"}
                              {value != null ? "/100" : ""}
                            </span>
                          </div>
                          <Progress value={value ?? 0} className="h-2" />
                        </div>
                      ))}
                    </div>
                    {review.behaviour_competencies && (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-xs text-blue-600">
                          View behavioural competency breakdown
                        </summary>
                        <div className="mt-2 grid grid-cols-2 gap-1">
                          {Object.entries(review.behaviour_competencies).map(([k, v]) => (
                            <div key={k} className="odd:bg-muted/50 flex justify-between rounded px-2 py-1">
                              <span className="capitalize">{k.replace("_", " ")}</span>
                              <span className="font-medium">{v}/100</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ) : (
                  /* Fallback: legacy star rating */
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">Overall Rating:</span>
                    {renderStars(review.overall_rating || 0)}
                    <span className="text-lg font-bold">{review.overall_rating || 0}/5</span>
                  </div>
                )}

                {/* Goals Progress */}
                {review.goals_total > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Goals Achieved:</span>
                    <span>
                      {review.goals_achieved}/{review.goals_total}
                    </span>
                  </div>
                )}

                {/* Strengths */}
                {review.strengths && (
                  <div>
                    <h4 className="mb-1 text-sm font-medium text-green-600">Strengths</h4>
                    <p className="rounded-lg bg-green-50 p-3 text-sm">{review.strengths}</p>
                  </div>
                )}

                {/* Areas for Improvement */}
                {review.areas_for_improvement && (
                  <div>
                    <h4 className="mb-1 text-sm font-medium text-orange-600">Areas for Improvement</h4>
                    <p className="rounded-lg bg-orange-50 p-3 text-sm">{review.areas_for_improvement}</p>
                  </div>
                )}

                {/* Manager Comments */}
                {review.manager_comments && (
                  <div>
                    <h4 className="mb-1 text-sm font-medium">Manager Comments</h4>
                    <p className="bg-muted rounded-lg p-3 text-sm">{review.manager_comments}</p>
                  </div>
                )}

                {review.employee_comments && (
                  <div>
                    <h4 className="mb-1 text-sm font-medium text-emerald-700">Employee Comments</h4>
                    <p className="rounded-lg bg-emerald-50 p-3 text-sm">{review.employee_comments}</p>
                  </div>
                )}

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

                <p className="text-muted-foreground text-xs">
                  Review Date: {new Date(review.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
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
                      {item.value ?? "-"}
                      {item.value != null ? "/100" : ""}
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
