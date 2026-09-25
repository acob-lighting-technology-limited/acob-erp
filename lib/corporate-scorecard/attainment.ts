/**
 * Corporate Scorecard attainment — the standard balanced-scorecard rules
 * agreed for this system:
 *
 *   1. Only CORE ownership scores a department. SUPPORT is visible and
 *      taggable but never counted — a department should not be marked down
 *      for a target it merely contributes to.
 *   2. A KPI's attainment is actual ÷ target, not task completion. Tasks are
 *      the evidence trail; the number is the result.
 *   3. Over-achievement is shown in full (a KPI can read 200%) but capped at
 *      100 when it feeds a rollup, so one exceptional result cannot mask
 *      several missed targets.
 *   4. Rollups are equal-weighted averages: KPI → objective → perspective →
 *      company, unless a caller deliberately overrides that.
 *
 * Every function here is pure — no I/O — so the numbers the department page,
 * the register, and the MD rollup show can never disagree about how a
 * percentage was reached.
 */

export type MeasureType = "count" | "percentage" | "currency" | "milestone"
export type Direction = "at_least" | "at_most"
export type RagStatus = "green" | "amber" | "red"

export const RAG_GREEN_THRESHOLD = 95
export const RAG_AMBER_THRESHOLD = 80

export type AttainmentInput = {
  measureType: MeasureType
  direction: Direction
  targetValue: number | null
  actualValue: number | null
  milestonesCompleted: number | null
  milestonesTotal: number | null
}

export type Attainment = {
  /** The true figure, uncapped — a KPI can read 200%. Null when there's nothing to compute from yet. */
  rawPct: number | null
  /** rawPct capped at 100, for use in any rollup average. */
  cappedPct: number | null
}

/**
 * One KPI's attainment for one department.
 *
 * Milestone KPIs ("developed / approved / implemented") are milestones
 * completed over milestones total — a target_value would mean nothing there.
 * Everything else is actual ÷ target, inverted for an "at_most" KPI (a lower
 * actual is the win — e.g. "% decrease in operational cost").
 */
export function computeAttainment(input: AttainmentInput): Attainment {
  const empty: Attainment = { rawPct: null, cappedPct: null }

  if (input.measureType === "milestone") {
    const total = input.milestonesTotal
    const completed = input.milestonesCompleted
    if (!total || total <= 0 || completed == null) return empty
    const raw = (completed / total) * 100
    return { rawPct: round(raw), cappedPct: round(Math.min(100, raw)) }
  }

  const target = input.targetValue
  const actual = input.actualValue
  if (target == null || target <= 0 || actual == null) return empty

  let raw: number
  if (input.direction === "at_most") {
    // Hitting zero against a "reduce to at most X" target is a full win, not
    // an undefined division — there is nothing left to reduce.
    raw = actual <= 0 ? 100 : (target / actual) * 100
  } else {
    raw = (actual / target) * 100
  }

  return { rawPct: round(raw), cappedPct: round(Math.min(100, raw)) }
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

/** ≥95 green · 80–94 amber · <80 red. Null (no data yet) is reported separately by callers. */
export function ragStatus(cappedPct: number): RagStatus {
  if (cappedPct >= RAG_GREEN_THRESHOLD) return "green"
  if (cappedPct >= RAG_AMBER_THRESHOLD) return "amber"
  return "red"
}

/**
 * Equal-weighted average of whatever capped percentages are present. Missing
 * data is skipped rather than treated as zero — a KPI nobody has recorded an
 * actual for yet is "no data", not "failed".
 */
export function averageCappedPct(values: Array<number | null | undefined>): number | null {
  const present = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v))
  if (present.length === 0) return null
  return round(present.reduce((sum, v) => sum + v, 0) / present.length)
}

export type ActualSource = "auto" | "manual" | "none"

export type ResolvedActual = {
  effectiveActual: number | null
  effectiveMilestonesCompleted: number | null
  effectiveMilestonesTotal: number | null
  source: ActualSource
  isOverride: boolean
  autoValue: number | null
  manualValue: number | null
  taskStats?: {
    total: number
    completed: number
    inProgress: number
  } | null
  note?: string | null
}

/**
 * Resolves effective actual by combining auto-detected system data (tasks)
 * with any manual managerial override.
 */
export function resolveEffectiveActual(params: {
  manualActual?: {
    actual_value: number | null
    milestones_completed: number | null
    milestones_total: number | null
    is_override?: boolean | null
    note?: string | null
  } | null
  autoDetected?: {
    value: number | null
    milestones_completed?: number | null
    milestones_total?: number | null
    taskStats?: { total: number; completed: number; inProgress: number } | null
  } | null
}): ResolvedActual {
  const manual = params.manualActual
  const auto = params.autoDetected

  const hasManualValue = manual && (manual.actual_value != null || manual.milestones_completed != null)

  if (hasManualValue) {
    return {
      effectiveActual: manual.actual_value ?? null,
      effectiveMilestonesCompleted: manual.milestones_completed ?? null,
      effectiveMilestonesTotal: manual.milestones_total ?? null,
      source: "manual",
      isOverride: manual.is_override ?? true,
      autoValue: auto?.value ?? null,
      manualValue: manual.actual_value ?? null,
      taskStats: auto?.taskStats ?? null,
      note: manual.note ?? null,
    }
  }

  const hasAutoValue = auto && (auto.value != null || auto.milestones_completed != null)

  if (hasAutoValue) {
    return {
      effectiveActual: auto.value ?? null,
      effectiveMilestonesCompleted: auto.milestones_completed ?? null,
      effectiveMilestonesTotal: auto.milestones_total ?? null,
      source: "auto",
      isOverride: false,
      autoValue: auto.value ?? null,
      manualValue: null,
      taskStats: auto.taskStats ?? null,
      note: auto.taskStats
        ? `Derived from ${auto.taskStats.completed} completed task${auto.taskStats.completed === 1 ? "" : "s"}`
        : null,
    }
  }

  return {
    effectiveActual: null,
    effectiveMilestonesCompleted: null,
    effectiveMilestonesTotal: null,
    source: "none",
    isOverride: false,
    autoValue: null,
    manualValue: null,
    taskStats: auto?.taskStats ?? null,
    note: null,
  }
}

export type KpiRollupRow = {
  perspective: string
  strategicObjective: string
  cappedPct: number | null
}

export type PerspectiveRollup = {
  perspective: string
  objectives: Array<{ strategicObjective: string; attainmentPct: number | null; kpiCount: number }>
  attainmentPct: number | null
}

/**
 * KPI → objective → perspective, each an equal-weighted average of the level
 * below. A perspective with zero recorded actuals reads null throughout
 * rather than as a 0%, which would read as "failing" instead of "not started".
 */
export function rollupByPerspective(rows: KpiRollupRow[]): PerspectiveRollup[] {
  const byPerspective = new Map<string, Map<string, number[]>>()

  for (const row of rows) {
    if (!byPerspective.has(row.perspective)) byPerspective.set(row.perspective, new Map())
    const objectives = byPerspective.get(row.perspective)!
    // Set unconditionally, even with no data yet, so the objective still
    // appears in the rollup rather than silently disappearing.
    if (!objectives.has(row.strategicObjective)) objectives.set(row.strategicObjective, [])
    if (row.cappedPct != null) objectives.get(row.strategicObjective)!.push(row.cappedPct)
  }

  const result: PerspectiveRollup[] = []
  for (const [perspective, objectives] of byPerspective) {
    const objectiveRows = Array.from(objectives.entries()).map(([strategicObjective, values]) => ({
      strategicObjective,
      attainmentPct: averageCappedPct(values),
      kpiCount: values.length,
    }))
    result.push({
      perspective,
      objectives: objectiveRows,
      attainmentPct: averageCappedPct(objectiveRows.map((o) => o.attainmentPct)),
    })
  }

  return result
}

/** Company-wide figure: equal-weighted average of the four perspectives. */
export function companyAttainment(perspectives: PerspectiveRollup[]): number | null {
  return averageCappedPct(perspectives.map((p) => p.attainmentPct))
}

export type PacingStatus = "ahead" | "on_pace" | "behind" | "no_data"

export type PacingResult = {
  status: PacingStatus
  elapsedPct: number
  label: string
}

/**
 * Evaluates whether current attainment is on pace relative to elapsed time in the target year.
 */
export function computePacingStatus(
  cappedPct: number | null | undefined,
  now: Date = new Date(),
  targetYear = 2026
): PacingResult {
  const currentYear = now.getFullYear()
  if (currentYear < targetYear) {
    return { status: "on_pace", elapsedPct: 0, label: `Scheduled for ${targetYear}` }
  }
  if (currentYear > targetYear) {
    if (cappedPct == null) return { status: "no_data", elapsedPct: 100, label: "Target year ended" }
    return cappedPct >= RAG_GREEN_THRESHOLD
      ? { status: "ahead", elapsedPct: 100, label: "Goal Achieved" }
      : { status: "behind", elapsedPct: 100, label: "Target year ended" }
  }

  const start = new Date(targetYear, 0, 1).getTime()
  const end = new Date(targetYear, 11, 31, 23, 59, 59).getTime()
  const current = Math.min(Math.max(now.getTime(), start), end)
  const elapsedPct = Math.round(((current - start) / (end - start)) * 100)

  if (cappedPct == null) {
    return { status: "no_data", elapsedPct, label: `${elapsedPct}% of year elapsed` }
  }

  if (cappedPct >= elapsedPct + 5) {
    return { status: "ahead", elapsedPct, label: "Ahead of schedule" }
  }
  if (cappedPct >= elapsedPct - 15) {
    return { status: "on_pace", elapsedPct, label: "On pace" }
  }
  return { status: "behind", elapsedPct, label: "Behind schedule" }
}
