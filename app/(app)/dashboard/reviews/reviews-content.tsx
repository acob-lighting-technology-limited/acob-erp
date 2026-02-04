"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Star, FileText } from "lucide-react"
import Link from "next/link"
import type { Review } from "./page"

interface ReviewsContentProps {
  initialReviews: Review[]
}

export function ReviewsContent({ initialReviews }: ReviewsContentProps) {
  const [reviews] = useState<Review[]>(initialReviews)

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
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reviews.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{averageRating.toFixed(1)}</span>
              <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
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
                {/* Rating */}
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">Overall Rating:</span>
                  {renderStars(review.overall_rating || 0)}
                  <span className="text-lg font-bold">{review.overall_rating || 0}/5</span>
                </div>

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

                <p className="text-muted-foreground text-xs">
                  Review Date: {new Date(review.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
