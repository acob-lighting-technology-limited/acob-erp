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
