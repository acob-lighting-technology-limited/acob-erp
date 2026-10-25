import { redirect } from "next/navigation"
import { mergeDuplicateReviews, pickCanonicalReview, reviewStatusPriority } from "@/lib/pms/reviews"
import { unstable_noStore as noStore } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getUnifiedPerformanceReviews, type UnifiedReviewRow } from "@/lib/performance/review-data"
import { ReviewsContent } from "./reviews-content"

import { logger } from "@/lib/logger"

const log = logger("dashboard-reviews")
export const dynamic = "force-dynamic"

export interface Review {
  id: string
  user_id?: string | null
  overall_rating: number | null
  strengths: string | null
  areas_for_improvement: string | null
  goals_achieved: number | null
  goals_total: number | null
  manager_comments: string | null
  status: string | null
  created_at: string
  // PMS 4-component scores
  kpi_score?: number | null
  cbt_score?: number | null
  attendance_score?: number | null
  behaviour_score?: number | null
  final_score?: number | null
  acknowledged_at?: string | null
  acknowledged_by?: string | null
  employee_comments?: string | null
  behaviour_competencies?: {
    collaboration?: number
    accountability?: number
    communication?: number
    teamwork?: number
    loyalty?: number
    professional_conduct?: number
  } | null
  review_cycle_id?: string | null
  reviewer_id?: string | null
  review_cycle: {
    id: string | null
    name: string
    review_type: string
    start_date: string | null
    end_date: string | null
  }
  reviewer: {
    first_name: string
    last_name: string
  }
}

async function getReviewsData() {
  noStore()
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  let reviewRows: UnifiedReviewRow[] = []
  try {
    const result = await getUnifiedPerformanceReviews(supabase, { userId: user.id, limit: 200 })
    reviewRows = result.reviews
  } catch (error) {
    log.error("Error loading reviews:", error)
    return { reviews: [] as Review[] }
  }

  if (reviewRows.length === 0) {
    return { reviews: [] as Review[] }
  }

  const hydratedReviews: Review[] = reviewRows.map((review) => ({
    ...review,
    review_cycle: {
      id: review.cycle?.id || review.review_cycle_id || null,
      name: review.cycle?.name || "Performance Review",
      review_type: review.cycle?.review_type || "standard",
      start_date: review.cycle?.start_date || null,
      end_date: review.cycle?.end_date || null,
    },
    reviewer: {
      first_name: review.reviewer?.first_name || "Unknown",
      last_name: review.reviewer?.last_name || "Reviewer",
    },
  }))

  return {
    reviews: mergeDuplicateReviews(hydratedReviews).sort(
      (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    ),
  }
}

export default async function ReviewsPage() {
  const data = await getReviewsData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const reviewsData = data as { reviews: Review[] }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return <ReviewsContent initialReviews={reviewsData.reviews} currentUserId={user?.id || ""} />
}
