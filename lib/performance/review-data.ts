import type { SupabaseClient } from "@supabase/supabase-js"
import { computeIndividualPerformanceScore } from "@/lib/performance/scoring"

type BaseReviewRow = {
  id: string
  user_id: string
  review_cycle_id: string | null
  reviewer_id: string | null
  review_date: string | null
  overall_rating: number | null
  status: string | null
  self_review_completed: boolean | null
  manager_review_completed: boolean | null
  employee_comments: string | null
  manager_comments: string | null
  goals_achieved: number | null
  goals_total: number | null
  created_at: string
  updated_at: string | null
  kpi_score: number | null
  cbt_score: number | null
  attendance_score: number | null
  behaviour_score: number | null
  final_score: number | null
  behaviour_competencies: Record<string, unknown> | null
  strengths: string | null
  areas_for_improvement: string | null
}

type ProfileLookup = {
  id: string
  first_name: string | null
  last_name: string | null
  full_name?: string | null
  company_email?: string | null
  department_id?: string | null
  department?: string | null
}

type CycleLookup = {
  id: string
  name: string
  review_type: string | null
  start_date?: string | null
  end_date?: string | null
}

export type UnifiedReviewRow = BaseReviewRow & {
  user: ProfileLookup | null
  reviewer: ProfileLookup | null
  cycle: CycleLookup | null
}

function normalizeCycleKey(cycleId: string | null | undefined) {
  return cycleId || "__no_cycle__"
}

type ReviewFilter = {
  userId?: string | null
  cycleId?: string | null
  limit?: number
  offset?: number
  /** Pre-resolved set of user IDs to restrict results to (dept scoping). null = no restriction. */
  userIds?: string[]
}

export async function getUnifiedPerformanceReviews(
  supabase: SupabaseClient,
  filters: ReviewFilter = {}
): Promise<{ reviews: UnifiedReviewRow[]; total: number }> {
  const limit = filters.limit ?? 50
  const offset = filters.offset ?? 0

  let query = supabase
    .from("performance_reviews")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (filters.userId) {
    query = query.eq("user_id", filters.userId)
  } else if (filters.userIds && filters.userIds.length > 0) {
    // Dept-scoped list view: restrict to pre-resolved user IDs
    query = query.in("user_id", filters.userIds)
  }
  if (filters.cycleId) {
    query = query.eq("review_cycle_id", filters.cycleId)
  }

  const { data: reviews, error, count } = await query.returns<BaseReviewRow[]>()
  if (error || !reviews) {
    throw new Error(error?.message || "Failed to load performance reviews")
  }
  if (reviews.length === 0) return { reviews: [], total: count ?? 0 }

  const userIds = Array.from(new Set(reviews.map((row) => row.user_id).filter(Boolean)))
  const reviewerIds = Array.from(new Set(reviews.map((row) => row.reviewer_id).filter(Boolean))) as string[]
  const cycleIds = Array.from(new Set(reviews.map((row) => row.review_cycle_id).filter(Boolean))) as string[]

  const [{ data: users }, { data: reviewers }, { data: cycles }] = await Promise.all([
    userIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, first_name, last_name, full_name, company_email, department_id, department")
          .in("id", userIds)
          .returns<ProfileLookup[]>()
      : Promise.resolve({ data: [] as ProfileLookup[] }),
    reviewerIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, first_name, last_name, full_name")
          .in("id", reviewerIds)
          .returns<ProfileLookup[]>()
      : Promise.resolve({ data: [] as ProfileLookup[] }),
    cycleIds.length > 0
      ? supabase
          .from("review_cycles")
          .select("id, name, review_type, start_date, end_date")
          .in("id", cycleIds)
          .returns<CycleLookup[]>()
      : Promise.resolve({ data: [] as CycleLookup[] }),
  ])

  const userById = new Map((users || []).map((profile) => [profile.id, profile]))
  const reviewerById = new Map((reviewers || []).map((profile) => [profile.id, profile]))
  const cycleById = new Map((cycles || []).map((cycle) => [cycle.id, cycle]))

  const scoreKeys = Array.from(
    new Set(reviews.map((row) => `${row.user_id}:${normalizeCycleKey(row.review_cycle_id)}`))
  )
  const scoreByKey = new Map(
    await Promise.all(
      scoreKeys.map(async (key) => {
        const [userId, rawCycleId] = key.split(":")
        const cycleId = rawCycleId === "__no_cycle__" ? null : rawCycleId
        const score = await computeIndividualPerformanceScore(supabase, { userId, cycleId })
        return [key, score] as const
      })
    )
  )

  const unified = reviews.map((row) => {
    const scoreKey = `${row.user_id}:${normalizeCycleKey(row.review_cycle_id)}`
    const score = scoreByKey.get(scoreKey)

    return {
      ...row,
      kpi_score: score ? score.kpi_score : row.kpi_score,
      cbt_score: score ? score.cbt_score : row.cbt_score,
      attendance_score: score ? score.attendance_score : row.attendance_score,
      behaviour_score: score ? score.behaviour_score : row.behaviour_score,
      final_score: score ? score.final_score : row.final_score,
      user: userById.get(row.user_id) || null,
      reviewer: row.reviewer_id ? reviewerById.get(row.reviewer_id) || null : null,
      cycle: row.review_cycle_id ? cycleById.get(row.review_cycle_id) || null : null,
    }
  })

  return { reviews: unified, total: count ?? unified.length }
}
