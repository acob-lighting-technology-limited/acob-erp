import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const OFFICE_WEEK_ANCHOR_MONTH_INDEX = 0
const OFFICE_WEEK_ANCHOR_DAY = 12

function getOfficeYearStart(year: number): Date {
  return new Date(year, OFFICE_WEEK_ANCHOR_MONTH_INDEX, OFFICE_WEEK_ANCHOR_DAY)
}

export function getOfficeWeekFromDate(date: Date): { week: number; year: number } {
  const input = new Date(date)
  let year = input.getFullYear()
  let yearStart = getOfficeYearStart(year)

  if (input < yearStart) {
    year -= 1
    yearStart = getOfficeYearStart(year)
  }

  const diffMs = input.getTime() - yearStart.getTime()
  const week = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1
  return { week, year }
}

export function getCurrentOfficeWeek(): { week: number; year: number } {
  return getOfficeWeekFromDate(new Date())
}

function normalizeDateInput(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
  }

  const raw = String(value || "").trim()
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    return new Date(Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3])))
  }

  const normalized = raw
    .replace(/(\d+)(st|nd|rd|th)/gi, "$1")
    .replace(/,\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid meeting date: ${raw}`)
  }

  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()))
}

export function toIsoDateString(value: string | Date): string {
  const date = normalizeDateInput(value)
  const yyyy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(date.getUTCDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export function formatMeetingDateLabel(value: string | Date): string {
  return normalizeDateInput(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

function normalizeDisplayToken(value: string): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
}

function ensureExtension(extension?: string): string {
  const normalized = String(extension || "pdf")
    .trim()
    .replace(/^\./, "")
    .toLowerCase()
  return normalized || "pdf"
}

export function buildMeetingDocumentFileName(params: {
  documentType: "knowledge_sharing_session" | "minutes" | "action_points"
  meetingDate: string | Date
  meetingWeek: number
  extension?: string
  department?: string | null
  presenterName?: string | null
}): string {
  const dateLabel = formatMeetingDateLabel(params.meetingDate)
  const extension = ensureExtension(params.extension)

  if (params.documentType === "knowledge_sharing_session") {
    return `KSS - ${normalizeDisplayToken(params.department || "Unknown Department")} - ${normalizeDisplayToken(params.presenterName || "Unknown Presenter")} - ${dateLabel} - W${params.meetingWeek}.${extension}`
  }

  if (params.documentType === "minutes") {
    return `Minutes of Meeting - ${dateLabel} - W${params.meetingWeek}.${extension}`
  }

  return `Action Points - ${dateLabel} - W${params.meetingWeek}.${extension}`
}

export async function resolveEffectiveMeetingDateIso(
  supabase: ReturnType<typeof createClient>,
  week: number,
  year: number
): Promise<string> {
  const { data, error } = await supabase.rpc("weekly_report_effective_meeting_date", {
    p_week: week,
    p_year: year,
  })

  if (error) {
    throw new Error(error.message)
  }

  return toIsoDateString(String(data))
}
