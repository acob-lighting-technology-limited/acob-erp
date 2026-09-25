/**
 * Weighted task scoring — the single definition of how task work becomes a score.
 *
 * Every task carries a compulsory weight (1-10) and, once approved, a rating
 * (1-5) from its rater. A task is therefore worth `weight` points and earns
 * `weight * rating/5` of them:
 *
 *   weight 5, rating 4/5  →  4 of a possible 5
 *
 * The employee's KPI percentage — 70% of the half-year appraisal — is the sum
 * of what they earned over the sum of what was available. Weight is relative,
 * not a percentage, so a project's weights are deliberately not constrained to
 * total 100: adding a task never forces a rebalance of the existing ones.
 *
 * PMS scoring reads from here. Project pages count tasks instead, in
 * lib/projects/health.ts, so everyone can check the figures by hand.
 */

export const TASK_WEIGHT_MIN = 1
export const TASK_WEIGHT_MAX = 5
export const TASK_WEIGHT_DEFAULT = 3

export const TASK_RATING_MIN = 1
export const TASK_RATING_MAX = 5

/** Neutral for scoring: the work moved elsewhere or was called off, so it is
 *  neither credit nor failure for this employee. */
const EXCLUDED_STATUSES = new Set(["reassigned", "cancelled"])

/**
 * Still being worked on, and so not yet judged either way.
 *
 * These used to score zero at full weight from the moment the task was
 * assigned, which meant a task due at the end of the quarter dragged the
 * employee's KPI down for every week they were not yet late. The rule existed
 * because abandoned work had to count against someone - but the nightly expiry
 * job now resolves anything past its deadline to `failed` within two working
 * days, so unfinished work reaches the score on its own and no longer has to
 * be presumed failed in advance.
 */
const UNRESOLVED_STATUSES = new Set(["pending", "in_progress", "unable_to_complete"])

/** Task ratings and weights are strictly numeric (1–5) and must never display descriptive text labels. */
/** @deprecated Task ratings are strictly numeric (1–5) without text descriptions. Retained only for legacy compatibility. */
export const TASK_RATING_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Below expectation",
  3: "Met expectation",
  4: "Exceeded expectation",
  5: "Outstanding",
}

export type ScorableTask = {
  status?: string | null
  weight?: number | null
  rating?: number | null
  is_archived?: boolean | null
}

export type CycleAnchoredTask = {
  task_end_date?: string | null
  due_date?: string | null
  created_at?: string | null
}

/**
 * The date that decides which review cycle a task belongs to.
 *
 * Its deadline — due_date or task_end_date (using the later date if both exist),
 * falling back to the creation date only when a task carries no deadline at all.
 * Anchoring on the completion date instead would let late work quietly migrate into
 * the next cycle and leave the cycle it was actually owed in looking better than it was.
 */
export function taskCycleAnchor(task: CycleAnchoredTask): string | null {
  if (task.due_date && task.task_end_date) {
    const due = String(task.due_date).slice(0, 10)
    const end = String(task.task_end_date).slice(0, 10)
    return due > end ? due : end
  }
  const anchor = task.due_date || task.task_end_date || task.created_at
  return anchor ? anchor.slice(0, 10) : null
}

export function isTaskInCycle(task: CycleAnchoredTask, cycleStart: string, cycleEnd: string): boolean {
  const day = taskCycleAnchor(task)
  if (!day) return false
  return day >= cycleStart && day <= cycleEnd
}

export function clampWeight(value: unknown): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return TASK_WEIGHT_DEFAULT
  return Math.min(TASK_WEIGHT_MAX, Math.max(TASK_WEIGHT_MIN, n))
}

export function isValidRating(value: unknown): boolean {
  const n = Number(value)
  return Number.isInteger(n) && n >= TASK_RATING_MIN && n <= TASK_RATING_MAX
}

/**
 * Does this task belong in the KPI calculation yet?
 *
 * A task is judged once, when it is resolved:
 *
 *   completed and rated  →  earns weight * rating/5
 *   failed               →  zero at full weight
 *   reassigned/cancelled →  out entirely, neither credit nor failure
 *
 * Everything else is held out rather than presumed failed. Work still in
 * progress has not been judged, and neither has work delivered but waiting on
 * a rater - holding the latter back is deliberate, so a slow rater cannot cost
 * an employee a zero on work they already delivered.
 *
 * This leans on the nightly expiry job: unfinished work past its deadline
 * becomes `failed` within two working days and enters the score there. If that
 * job stops running, unfinished work stops reaching the score at all and
 * everyone's KPI drifts upward silently - which is why its health is
 * monitored rather than this function second-guessing the deadline.
 */
export function isTaskScorable(task: ScorableTask): boolean {
  if (task.is_archived) return false
  const status = String(task.status || "").toLowerCase()
  if (EXCLUDED_STATUSES.has(status)) return false
  if (UNRESOLVED_STATUSES.has(status)) return false
  if (isAwaitingRating(task)) return false
  return true
}

/** Assigned and still being worked on: counted nowhere in the score yet. */
export function isTaskUnresolved(task: ScorableTask): boolean {
  if (task.is_archived) return false
  return UNRESOLVED_STATUSES.has(String(task.status || "").toLowerCase())
}

/**
 * Delivered but not yet judged.
 *
 * Submitted work obviously qualifies. So does a completed task with no rating:
 * a rating is mandatory to complete one now, so any such row predates that rule
 * — scoring it zero would punish an employee for work they actually finished.
 */
export function isAwaitingRating(task: ScorableTask): boolean {
  const status = String(task.status || "").toLowerCase()
  if (task.rating != null) return false
  return status === "submitted_for_review" || status === "completed"
}

/** Points earned by one task: weight * rating/5. Unrated work earns nothing. */
export function taskEarnedPoints(task: ScorableTask): number {
  const weight = clampWeight(task.weight)
  const rating = Number(task.rating)
  if (!isValidRating(rating)) return 0
  return (weight * rating) / TASK_RATING_MAX
}

export type WeightedTaskScore = {
  /** Weighted score 0-100, or null when there is no scorable work at all. */
  score: number | null
  earnedPoints: number
  availablePoints: number
  taskCount: number
  ratedCount: number
  /** Delivered but awaiting a rating — held out of the calculation. */
  awaitingRatingCount: number
  /** Assigned and still in progress — not yet judged, so not yet counted. */
  unresolvedCount: number
}

/**
 * Weighted score across a set of tasks: SUM(weight * rating/5) / SUM(weight).
 *
 * Returns null rather than 0 when nothing is scorable, so "no work assigned"
 * stays distinguishable from "work assigned and failed".
 */
export type WeightedScoreOptions = {
  /**
   * Count unfinished work as zero at full weight instead of holding it out.
   *
   * False for an employee's KPI: a task that is not yet due has not been
   * judged, and presuming it failed would penalise them for every week they
   * were not yet late. True for a project's quality figure, where the question
   * is "how good is this project's delivered work as a share of everything
   * planned" - a project half of whose work is untouched must not read as
   * perfect quality on the strength of the half that is done.
   */
  countUnresolvedAsZero?: boolean
}

export function computeWeightedTaskScore(tasks: ScorableTask[], options: WeightedScoreOptions = {}): WeightedTaskScore {
  let earnedPoints = 0
  let availablePoints = 0
  let taskCount = 0
  let ratedCount = 0
  let awaitingRatingCount = 0
  let unresolvedCount = 0

  for (const task of tasks) {
    if (task.is_archived) continue

    if (isAwaitingRating(task)) {
      awaitingRatingCount++
      continue
    }
    if (isTaskUnresolved(task)) {
      unresolvedCount++
      if (!options.countUnresolvedAsZero) continue
      availablePoints += clampWeight(task.weight)
      taskCount++
      continue
    }
    if (!isTaskScorable(task)) continue

    taskCount++
    availablePoints += clampWeight(task.weight)
    earnedPoints += taskEarnedPoints(task)
    if (isValidRating(task.rating)) ratedCount++
  }

  const score = availablePoints > 0 ? Math.round((earnedPoints / availablePoints) * 100 * 100) / 100 : null

  return { score, earnedPoints, availablePoints, taskCount, ratedCount, awaitingRatingCount, unresolvedCount }
}

/**
 * Visual badge styling for task weights (1 to 5).
 * Higher weight tasks have greater visual intensity.
 */
export function getTaskWeightBadgeClass(weight?: number | null): string {
  const w = clampWeight(weight)
  switch (w) {
    case 5:
      return "border-purple-300 bg-purple-500/15 text-purple-700 dark:border-purple-800 dark:text-purple-300 font-semibold"
    case 4:
      return "border-sky-300 bg-sky-500/15 text-sky-700 dark:border-sky-800 dark:text-sky-300 font-medium"
    case 3:
      return "border-teal-300 bg-teal-500/15 text-teal-700 dark:border-teal-800 dark:text-teal-300 font-medium"
    case 2:
      return "border-slate-300 bg-slate-500/10 text-slate-700 dark:border-slate-700 dark:text-slate-300"
    case 1:
    default:
      return "border-border/70 bg-muted/40 text-muted-foreground"
  }
}
