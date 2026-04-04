import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ReviewsContent } from "./reviews-content"

import { logger } from "@/lib/logger"

const log = logger("dashboard-reviews")

export interface Review {
  id: string
  overall_rating: number
  strengths: string
  areas_for_improvement: string
  goals_achieved: number
  goals_total: number
  manager_comments: string
  status: string
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
  review_cycle: {
    name: string
    review_type: string
  }
  reviewer: {
    first_name: string
    last_name: string
  }
}

async function getReviewsData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  // Fetch user's reviews
  const { data: reviews, error } = await supabase
    .from("performance_reviews")
    .select(
      `
      *,
      review_cycle:review_cycles(name, review_type),
      reviewer:profiles!reviewer_id(first_name, last_name)
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    log.error("Error loading reviews:", error)
  }

  return {
    reviews: (reviews || []) as Review[],
  }
}

export default async function ReviewsPage() {
  const data = await getReviewsData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const reviewsData = data as { reviews: Review[] }

  return <ReviewsContent initialReviews={reviewsData.reviews} />
}
