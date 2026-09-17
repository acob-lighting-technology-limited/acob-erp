import { z } from "zod"

/**
 * The ACOB Risk Register template, as data.
 *
 * Scales and wording come straight from the spreadsheet Corporate Services
 * circulates, so the form, the table and the Excel export all speak the same
 * language as the sheet departments already fill in.
 */

export const IMPACT_LEVELS = [
  { value: 1, label: "Insignificant" },
  { value: 2, label: "Little" },
  { value: 3, label: "Significant" },
  { value: 4, label: "Severe" },
  { value: 5, label: "Catastrophic" },
] as const

export const LIKELIHOOD_LEVELS = [
  { value: 1, label: "Rare", band: "< 10%" },
  { value: 2, label: "Unlikely", band: "10% – 25%" },
  { value: 3, label: "Possible", band: "26% – 50%" },
  { value: 4, label: "Likely", band: "51% – 75%" },
  { value: 5, label: "Almost Certain", band: "> 75%" },
] as const

export type RiskRating = "green" | "yellow" | "red"
export type RiskStatus = "open" | "in_progress" | "closed"
export type RiskTimelineType = "by_date" | "continuous"

export const RATING_LABELS: Record<RiskRating, string> = {
  green: "Green",
  yellow: "Yellow",
  red: "Red",
}

export const RATING_BANDS: Record<RiskRating, string> = {
  green: "1 – 4",
  yellow: "5 – 12",
  red: "15 – 25",
}

export const STATUS_LABELS: Record<RiskStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  closed: "Closed",
}

/** Mirrors the generated `rating` column in the database. Keep the two in step. */
export function ratingForScore(score: number): RiskRating {
  if (score >= 15) return "red"
  if (score >= 5) return "yellow"
  return "green"
}

export function impactLabel(value: number): string {
  return IMPACT_LEVELS.find((l) => l.value === value)?.label ?? String(value)
}

export function likelihoodLabel(value: number): string {
  return LIKELIHOOD_LEVELS.find((l) => l.value === value)?.label ?? String(value)
}

/** "BGI-03": the department code (or name) plus the S/N within that department. */
export function riskReference(departmentCode: string | null | undefined, department: string, serialNo: number): string {
  return `${departmentCode || department}-${String(serialNo).padStart(2, "0")}`
}

/**
 * A mitigation is overdue when it has a target date that has passed and the
 * risk is still being worked. Continuous mitigations are never overdue.
 * `today` is a YYYY-MM-DD string so the comparison is calendar-based.
 */
export function isRiskOverdue(
  risk: { status: RiskStatus; timeline_type: RiskTimelineType; target_date: string | null },
  today: string
): boolean {
  if (risk.status === "closed" || risk.timeline_type !== "by_date" || !risk.target_date) return false
  return risk.target_date < today
}

export interface RiskRow {
  id: string
  serial_no: number
  department: string
  supporting_departments: string[]
  risk_name: string
  description: string
  causes: string | null
  consequence: string | null
  impact: number
  likelihood: number
  score: number
  rating: RiskRating
  control_owner_departments: string[]
  control_owner_id: string | null
  mitigation_plan: string | null
  timeline_type: RiskTimelineType
  target_date: string | null
  timeline_note: string | null
  status: RiskStatus
  closed_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export const RISK_COLUMNS =
  "id, serial_no, department, supporting_departments, risk_name, description, causes, consequence, impact, likelihood, score, rating, control_owner_departments, control_owner_id, mitigation_plan, timeline_type, target_date, timeline_note, status, closed_at, created_by, updated_by, created_at, updated_at"

const optionalText = z
  .string()
  .trim()
  .max(5000)
  .nullish()
  .transform((v) => (v ? v : null))

const level = z.number().int().min(1).max(5)

const riskFields = {
  department: z.string().trim().min(1, "Select the department or unit"),
  supporting_departments: z.array(z.string().trim().min(1)).max(20).default([]),
  risk_name: z.string().trim().min(3, "Risk name must be at least 3 characters").max(200),
  description: z.string().trim().min(1, "Describe the risk").max(5000),
  causes: optionalText,
  consequence: optionalText,
  impact: level,
  likelihood: level,
  control_owner_departments: z.array(z.string().trim().min(1)).min(1, "Select at least one control owner").max(20),
  control_owner_id: z
    .string()
    .uuid()
    .nullish()
    .transform((v) => v ?? null),
  mitigation_plan: optionalText,
  timeline_type: z.enum(["by_date", "continuous"]),
  target_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Target date must be a date")
    .nullish()
    .transform((v) => v ?? null),
  timeline_note: optionalText,
  status: z.enum(["open", "in_progress", "closed"]).default("open"),
}

function checkTimeline(
  value: { timeline_type?: RiskTimelineType; target_date?: string | null },
  ctx: z.RefinementCtx,
  requireDate: boolean
) {
  if (value.timeline_type === "by_date" && requireDate && !value.target_date) {
    ctx.addIssue({ code: "custom", path: ["target_date"], message: "Set a target date, or mark it continuous" })
  }
}

export const CreateRiskSchema = z
  .object(riskFields)
  .superRefine((v, ctx) => checkTimeline(v, ctx, true))
  .transform((v) => (v.timeline_type === "continuous" ? { ...v, target_date: null } : v))

export const UpdateRiskSchema = z
  .object(riskFields)
  .partial()
  // Switching (or re-sending) a dated timeline must carry its date.
  .superRefine((v, ctx) => checkTimeline(v, ctx, true))
  .transform((v) => (v.timeline_type === "continuous" ? { ...v, target_date: null } : v))

export type CreateRiskInput = z.infer<typeof CreateRiskSchema>
export type UpdateRiskInput = z.infer<typeof UpdateRiskSchema>

/** Fields a named control owner may change without being an admin or the lead. */
export const OWNER_EDITABLE_FIELDS = [
  "mitigation_plan",
  "timeline_type",
  "target_date",
  "timeline_note",
  "status",
] as const satisfies ReadonlyArray<keyof UpdateRiskInput>
