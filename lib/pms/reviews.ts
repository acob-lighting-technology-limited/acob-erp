/**
 * Choosing the one review that counts when an employee has several rows for the
 * same cycle (duplicates from re-submissions or imports).
 *
 * Shared by the staff Reviews page, both admin review views and the reviews API
 * so every surface shows the same review. These used to be four copies that had
 * drifted: only the staff page preferred a review with written feedback.
 */

export interface CanonicalReviewCandidate {
  status: string | null
  created_at: string
  strengths?: string | null
  areas_for_improvement?: string | null
  manager_comments?: string | null
}

/** completed > submitted > draft > anything else. */
export function reviewStatusPriority(status: string | null | undefined): number {
  const normalized = String(status || "").toLowerCase()
  if (normalized === "completed") return 3
  if (normalized === "submitted") return 2
  if (normalized === "draft") return 1
  return 0
}

function hasNarrative(review: CanonicalReviewCandidate): number {
  return Number(Boolean(review.strengths || review.areas_for_improvement || review.manager_comments))
}

/**
 * The most-advanced review; ties go to the one with written feedback, then to
 * the newest. Callers pass a non-empty group (one employee's rows for a cycle).
 */
export function pickCanonicalReview<T extends CanonicalReviewCandidate>(reviews: readonly T[]): T {
  return [...reviews].sort((left, right) => {
    const statusDiff = reviewStatusPriority(right.status) - reviewStatusPriority(left.status)
    if (statusDiff !== 0) return statusDiff
    const narrativeDiff = hasNarrative(right) - hasNarrative(left)
    if (narrativeDiff !== 0) return narrativeDiff
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  })[0] as T
}

export interface MergeableReview extends CanonicalReviewCandidate {
  id: string
  user_id?: string | null
  review_cycle_id?: string | null
  kpi_score?: number | null
  cbt_score?: number | null
  attendance_score?: number | null
  behaviour_score?: number | null
  final_score?: number | null
  employee_comments?: string | null
}

/**
 * Groups reviews by user and cycle, picks the canonical review for status/comments,
 * and recomputes the weighted final score across available component metrics.
 */
export function mergeDuplicateReviews<T extends MergeableReview>(reviews: T[]): T[] {
  const grouped = new Map<string, T[]>()
  for (const review of reviews) {
    const key = `${review.user_id || "unknown"}:${review.review_cycle_id || "no-cycle"}`
    const existing = grouped.get(key) || []
    existing.push(review)
    grouped.set(key, existing)
  }

  return Array.from(grouped.values()).map((group) => {
    const canonical = pickCanonicalReview(group)

    const latestValue = <V>(pick: (review: T) => V | null | undefined): V | null => {
      const found = [...group]
        .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
        .find((review) => pick(review) !== null && pick(review) !== undefined)
      if (!found) return null
      return (pick(found) ?? null) as V | null
    }

    const kpiScore = latestValue((review) => review.kpi_score)
    const cbtScore = latestValue((review) => review.cbt_score)
    const attendanceScore = latestValue((review) => review.attendance_score)
    const behaviourScore = latestValue((review) => review.behaviour_score)

    const metricParts = [
      { value: kpiScore, weight: 70 },
      { value: cbtScore, weight: 10 },
      { value: attendanceScore, weight: 10 },
      { value: behaviourScore, weight: 10 },
    ].filter((item): item is { value: number; weight: number } => item.value !== null)

    const totalWeight = metricParts.reduce((sum, item) => sum + item.weight, 0)
    const computedFinal =
      totalWeight > 0
        ? Math.round((metricParts.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight) * 100) / 100
        : null

    return {
      ...canonical,
      kpi_score: kpiScore,
      cbt_score: cbtScore,
      attendance_score: attendanceScore,
      behaviour_score: behaviourScore,
      final_score: computedFinal ?? latestValue((review) => review.final_score),
      strengths: canonical.strengths || latestValue((review) => review.strengths) || "",
      areas_for_improvement:
        canonical.areas_for_improvement || latestValue((review) => review.areas_for_improvement) || "",
      manager_comments: canonical.manager_comments || latestValue((review) => review.manager_comments) || "",
      employee_comments: canonical.employee_comments || latestValue((review) => review.employee_comments) || null,
    }
  })
}
