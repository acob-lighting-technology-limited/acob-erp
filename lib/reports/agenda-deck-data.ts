/**
 * Gathers everything the general-meeting agenda deck shows, in the browser:
 * weekly reports, the week's KSS and last week's minutes rendered to page
 * images, and the two birthday slides. Each part degrades to a note on its
 * section slide rather than failing the export — the deck is needed for the
 * meeting even when one piece is missing.
 */
import { apiFetch } from "@/lib/api-client"
import { createClient } from "@/lib/supabase/client"
import { getOfficeWeekFromDate } from "@/lib/meeting-week"
import { openWithPdfjs, renderPdfPage } from "@/lib/pdf/client-tools"
import { htmlToSlideTextBlocks } from "@/lib/rich-text"
import { sortReportsByDepartment, type WeeklyReport } from "@/lib/export-utils"
import type {
  AgendaDeckBirthdaySlide,
  AgendaDeckImage,
  AgendaDeckInput,
  AgendaDeckKssEntry,
} from "@/lib/export/agenda-deck"
import { captureBirthdaySlide } from "./birthday-slide"

type MeetingDocumentType = "knowledge_sharing_session" | "minutes"

interface MeetingDocumentRow {
  id: string
  meeting_week: number
  meeting_year: number
  department: string | null
  presenter_name: string | null
  file_name: string | null
  mime_type: string | null
  signed_url: string
}

/** Page images per document, so a mis-filed 300-page PDF cannot balloon the deck. */
const MAX_PAGES_PER_DOCUMENT = 60
const PAGE_IMAGE_MAX_SIDE = 1920
const PAGE_IMAGE_QUALITY = 0.85
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const toMMDD = (date: Date) =>
  `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

const formatShortDate = (date: Date) => `${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`

const isPdf = (row: MeetingDocumentRow) =>
  row.mime_type === "application/pdf" || (row.file_name ?? "").toLowerCase().endsWith(".pdf")

/** The week's submitted reports, read under RLS like the staff Weekly Reports page, so any staff member can export. */
export async function fetchAgendaWeeklyReports(week: number, year: number): Promise<WeeklyReport[]> {
  const { data, error } = await createClient()
    .from("weekly_reports")
    .select("id, department, week_number, year, work_done, tasks_new_week, challenges, status, user_id, created_at")
    .eq("status", "submitted")
    .eq("week_number", week)
    .eq("year", year)
  if (error) throw new Error(error.message || "Failed to load weekly reports")
  return sortReportsByDepartment((data || []) as WeeklyReport[])
}

async function listMeetingDocuments(week: number, year: number, documentType: MeetingDocumentType) {
  const query = new URLSearchParams({ week: String(week), year: String(year), documentType, currentOnly: "true" })
  const res = await apiFetch(`/api/reports/meeting-week-documents?${query.toString()}`, { cache: "no-store" })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error || "Failed to load meeting documents")
  return (json?.data || []) as MeetingDocumentRow[]
}

async function renderDocumentPages(
  row: MeetingDocumentRow,
  maxPages = MAX_PAGES_PER_DOCUMENT
): Promise<{ pages: AgendaDeckImage[]; totalPages: number }> {
  const res = await apiFetch(row.signed_url)
  if (!res.ok) throw new Error("Could not download the file")
  const pdf = await openWithPdfjs(await res.blob())
  try {
    const pages: AgendaDeckImage[] = []
    const pageCount = Math.min(pdf.numPages, maxPages)
    for (let n = 1; n <= pageCount; n++) {
      const { canvas } = await renderPdfPage(pdf, n, 4, PAGE_IMAGE_MAX_SIDE)
      pages.push({
        dataUrl: canvas.toDataURL("image/jpeg", PAGE_IMAGE_QUALITY),
        width: canvas.width,
        height: canvas.height,
      })
      canvas.width = canvas.height = 0
    }
    return { pages, totalPages: pdf.numPages }
  } finally {
    await pdf.destroy()
  }
}

/**
 * This week's KSS files. A PDF becomes page images; a PowerPoint stays a note,
 * because the browser cannot draw .pptx (uploads made on Vercel are stored as
 * the original file, since LibreOffice is not available there to convert them).
 */
export async function loadAgendaKss(week: number, year: number): Promise<AgendaDeckKssEntry[]> {
  const rows = await listMeetingDocuments(week, year, "knowledge_sharing_session")
  return Promise.all(
    rows.map(async (row): Promise<AgendaDeckKssEntry> => {
      const base = { presenterName: row.presenter_name, department: row.department }
      if (!isPdf(row)) return { ...base, pages: [], note: "presented from their own slides" }
      try {
        return { ...base, pages: (await renderDocumentPages(row)).pages }
      } catch {
        return { ...base, pages: [], note: "the PDF could not be read; presented from their own file" }
      }
    })
  )
}

/** The office week of the previous meeting, whose minutes this meeting reads. */
export function previousMeetingWeek(meetingDate: string) {
  return getOfficeWeekFromDate(addDays(new Date(`${meetingDate}T00:00:00`), -7))
}

/** The previous meeting's summary of minutes as slide text, or null when none was written. */
async function loadMinutesSummary(week: number, year: number) {
  const res = await apiFetch(`/api/reports/meeting-minutes-summaries?week=${week}&year=${year}`, { cache: "no-store" })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error || "Failed to load the summary of minutes")
  const row = (json?.data as { content_html: string }[] | undefined)?.[0]
  const blocks = row ? htmlToSlideTextBlocks(row.content_html) : []
  return blocks.length > 0 ? blocks : null
}

/**
 * Last week's summary of minutes as text slides. Without one the item is its
 * title slide alone — the full minutes PDF is not shown in the meeting.
 */
export async function loadAgendaMinutes(meetingDate: string): Promise<AgendaDeckInput["minutes"]> {
  const previous = previousMeetingWeek(meetingDate)
  const label = `Summary of Minutes — Week ${previous.week}, ${previous.year}`
  const summary = await loadMinutesSummary(previous.week, previous.year)
  return summary ? { summary, label } : { label, note: `Week ${previous.week}, ${previous.year}` }
}

/**
 * The Any Other Business birthday slide: the seven days before the meeting as
 * the spotlight, with the meeting day and the six after it as the "Coming up"
 * summary in the corner.
 */
export async function loadAgendaBirthdays(meetingDate: string): Promise<AgendaDeckBirthdaySlide[]> {
  const meeting = new Date(`${meetingDate}T00:00:00`)
  const past = { from: addDays(meeting, -7), to: addDays(meeting, -1) }
  const next = { from: meeting, to: addDays(meeting, 6) }
  const pastRange = `${formatShortDate(past.from)} – ${formatShortDate(past.to)}`
  const title = "Birthdays — past week & coming up"

  try {
    const capture = await captureBirthdaySlide({
      start: toMMDD(past.from),
      end: toMMDD(past.to),
      label: `Past week · ${pastRange}`,
      upStart: toMMDD(next.from),
      upEnd: toMMDD(next.to),
      upLabel: `${formatShortDate(next.from)} – ${formatShortDate(next.to)}`,
    })
    return [{ title, image: { dataUrl: capture.dataUrl, width: capture.width, height: capture.height } }]
  } catch (error) {
    return [
      {
        title,
        image: null,
        note: `${pastRange} — ${error instanceof Error ? error.message : "could not be loaded"}`,
      },
    ]
  }
}
