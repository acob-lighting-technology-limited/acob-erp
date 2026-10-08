/** Types, filenames, ordering, text clean-up and brand constants shared by every export format. Split out of lib/export-utils.ts (audit 5.10). */
import { DEPT_EXECUTIVE_MANAGEMENT } from "@/config/constants"
import { formatOfficeDateWithOrdinal, getOfficeWeekMonday } from "@/lib/meeting-week"
import { compareDepartments, getCanonicalDepartmentOrder, normalizeDepartmentName } from "@/shared/departments"

// Load pptxgenjs from the installed npm package via dynamic import.
// Dynamic import keeps it out of the SSR bundle (it requires browser APIs).
export type PptxShapeTypeMap = Record<string, string>

/** A run of text with its own formatting, for mixed-format text boxes. */
export type PptxTextRun = { text: string; options?: Record<string, unknown> }

export type PptxSlide = {
  background?: { color: string }
  transition?: { type: string; duration: number }
  addShape: (shapeName: string, options: Record<string, unknown>) => void
  addText: (text: string | PptxTextRun[], options: Record<string, unknown>) => void
  addImage: (options: Record<string, unknown>) => void
}

export type PptxPresentation = {
  layout: string
  ShapeType?: PptxShapeTypeMap
  addSlide: () => PptxSlide
  writeFile: (options: { fileName: string }) => Promise<string>
}

export type PptxConstructor = new () => PptxPresentation

export const loadPptxGenJS = async (): Promise<PptxConstructor> => {
  const mod = await import("pptxgenjs")
  return (mod.default ?? mod) as unknown as PptxConstructor
}

export type WeeklyReportProfile = {
  first_name?: string | null
  last_name?: string | null
}

export interface WeeklyReport {
  id: string
  department: string
  week_number: number
  year: number
  work_done: string
  tasks_new_week: string
  challenges: string
  status: string
  user_id: string
  created_at: string
  profiles?: WeeklyReportProfile | WeeklyReportProfile[] | null
}

export const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001F]+/g
export const inFlightActionPointFileExports = new Set<string>()

export const sanitizeFilenameSegment = (value: string) =>
  value.replace(INVALID_FILENAME_CHARS, " ").replace(/\s+/g, " ").trim()

export const resolveExportMeetingDate = (week: number, year: number, meetingDate?: string) => {
  if (meetingDate) {
    const parsed = new Date(`${meetingDate}T00:00:00`)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }

  const fallback = getOfficeWeekMonday(week, year)
  fallback.setHours(0, 0, 0, 0)
  return fallback
}

export const formatMeetingDateForFilename = (week: number, year: number, meetingDate?: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(resolveExportMeetingDate(week, year, meetingDate))

export const formatActionPointsDate = (week: number, year: number, meetingDate?: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(resolveExportMeetingDate(week, year, meetingDate))

export const formatMeetingDateWithWeekday = (date: Date): string => {
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "Africa/Lagos" }).format(date)
  return `${weekday}, ${formatOfficeDateWithOrdinal(date)}`
}

export const formatExportMeetingDateLabel = (week: number, year: number, meetingDate?: string) =>
  formatMeetingDateWithWeekday(resolveExportMeetingDate(week, year, meetingDate))

export const buildWeeklyReportFilename = ({
  week,
  year: _year,
  meetingDate,
  extension,
  department,
  allDepartments = false,
  theme,
}: {
  week: number
  year: number
  meetingDate?: string
  extension: string
  department?: string
  allDepartments?: boolean
  theme?: WeeklyPptxTheme
}) => {
  const parts = [
    allDepartments ? "ACOB Weekly Reports" : "ACOB Weekly Report",
    department ? sanitizeFilenameSegment(department) : null,
    formatMeetingDateForFilename(week, _year, meetingDate),
    `W${week}`,
    theme === "dark" ? "Dark Theme" : null,
  ].filter(Boolean)

  return `${parts.join(" - ")}.${extension}`
}

export const buildActionPointFilename = ({
  week,
  year: _year,
  meetingDate,
  extension,
  department,
}: {
  week: number
  year: number
  meetingDate?: string
  extension: string
  department?: string
}) => {
  const parts = [
    "ACOB Action Points",
    department ? sanitizeFilenameSegment(department) : null,
    formatMeetingDateForFilename(week, _year, meetingDate),
    `W${week}`,
  ].filter(Boolean)

  return `${parts.join(" - ")}.${extension}`
}

// ─── Constants & Sorting ──────────────────────────────────────────────────
export const DEPARTMENT_ORDER = getCanonicalDepartmentOrder().map((department) =>
  department === "Executive Management" ? DEPT_EXECUTIVE_MANAGEMENT : department
)

/**
 * Sorts reports based on the official ACOB department hierarchy.
 * Departments not in the list appear alphabetically at the end.
 */
export const sortReportsByDepartment = (reports: WeeklyReport[]) => {
  return [...reports].sort((a, b) => compareDepartments(a.department, b.department))
}

/**
 * Auto-numbers each non-empty line in current line order.
 * Existing numbers and pasted bullet prefixes are stripped first so inserted
 * middle items are renumbered instead of leaving duplicate numbers.
 */
/**
 * Strips ALL non-ASCII characters from report text.
 * Uses a whitelist approach: only printable ASCII (0x20-0x7E), newline, and carriage-return
 * are kept. This eliminates every possible Unicode backtick / tick / accent / fancy-quote /
 * zero-width character that copy-paste from Word / Outlook / email can introduce.
 */
export const sanitizeReportText = (s: string): string => s.replace(/[^\x20-\x7E\n\r]/g, "")

/** @deprecated use sanitizeReportText */
export const cleanPastedText = sanitizeReportText

export const autoNumberLines = (text: string): string => {
  if (!text?.trim()) return text || ""

  // First pass: strip all stray tick / backtick / accent characters from raw input
  const cleaned = cleanPastedText(text)

  const collapseSpacedLetters = (line: string) =>
    line.replace(/\b(?:[A-Za-z]\s+){3,}[A-Za-z]\b/g, (match) => match.replace(/\s+/g, ""))

  const sanitizeLine = (line: string) => {
    const result = line
      .replace(/\t+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      // strip stray punctuation marks that often appear before copied bullet/list text
      .replace(/^['`.,;:!?-]+\s*/, "")

    return collapseSpacedLetters(result)
  }

  const lines = cleaned
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => sanitizeLine(l))
    .filter((l) => l.trim().length > 0)
    .map((line) =>
      sanitizeLine(line)
        .replace(/^(?:\s*\d+[.)]\s*)+/, "")
        .trim()
    )
    .filter((line) => line.length > 0)

  return lines.map((l, i) => `${i + 1}. ${sanitizeLine(l)}`).join("\n")
}

/** Returns the office-week start date as a formatted string e.g. "Monday, 17th February, 2026" */
export const getWeekMonday = (week: number, year: number): string => {
  const monday = getOfficeWeekMonday(week, year)
  return formatMeetingDateWithWeekday(monday)
}

/**
 * Fetches an image URL and returns a crisp PNG data URL via an offscreen canvas.
 * WebP fed directly to jsPDF renders poorly — converting to PNG via canvas fixes it.
 * Uses 2× scale for retina-quality output.
 */
export const fetchImageAsBase64 = (url: string): Promise<string | null> =>
  new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      try {
        const scale = 2 // 2× for sharpness
        const canvas = document.createElement("canvas")
        canvas.width = img.naturalWidth * scale
        canvas.height = img.naturalHeight * scale
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.scale(scale, scale)
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL("image/png"))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })

// ─── PDF colour helpers ───────────────────────────────────────────────────────

export interface ActionItem {
  id: string
  title: string
  description?: string
  status: string
  department: string
  week_number: number
  year: number
  original_week?: number
}

export const formatStatusLabel = (status: string) =>
  status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")

export const groupActionItemsByDepartment = (actions: ActionItem[]) => {
  const grouped: Record<string, ActionItem[]> = {}
  actions.forEach((action) => {
    const department = normalizeDepartmentName(action.department)
    if (!grouped[department]) grouped[department] = []
    grouped[department].push({ ...action, department })
  })

  const departments = DEPARTMENT_ORDER.filter((dept) => grouped[dept])
  Object.keys(grouped).forEach((dept) => {
    if (!departments.includes(dept)) departments.push(dept)
  })

  return { grouped, departments }
}

/** Draws a single Action Point content page for a department. */

export const ACOB_GREEN = "1A7A4A" // primary green
export const ACOB_GREEN_LIGHT = "E8F5EE" // light green tint
// Deep green for the header/footer bars. Still clearly green, but white
// artwork sits at 9.6:1 against it instead of 5.4:1 on the primary green, so
// the logos in the bars actually read. (ACOB_DARK is 14.8:1 — that is why the
// old bar looked black.)
export const ACOB_GREEN_DEEP = "124F32"
export const ACOB_DARK = "0F2D1F" // deep dark green
export const ACOB_SLATE = "334155"
export const ACOB_MUTED = "64748B"
export const ACOB_WHITE = "FFFFFF"
export const ACOB_OFFWHITE = "F8FAF9"

// Section accents. Challenges is amber rather than red: every report has the
// section, so red made a routine "nothing major this week" read as an alarm.
export const SECTION_WORK_DONE = ACOB_GREEN
export const SECTION_TASKS = "1D6A96"
export const SECTION_CHALLENGES = "B45309"

// Export logo assets.
//
// These live in /images/exports/ and are deliberately separate from the web
// assets: PptxGenJS embeds a fresh copy of the image bytes for every addImage
// call (it does not dedupe), so a 60-slide deck carries 60 copies. They are
// downscaled to roughly the resolution they are rendered at.
//
// `ratio` is the asset's true width/height. Always derive the box from it via
// the helpers below — passing mismatched w/h to addImage stretches the artwork,
// which is exactly how the Matrix mark ended up squashed into the old
// 4.6 x 1.15 box that had been sized for the wide ACOB wordmark.
export const EXPORT_LOGOS = {
  /** ACOB LIGHTING wordmark, dark text — for white/light backgrounds. */
  acobFull: { path: "/images/exports/acob-lighting-full.png", ratio: 1200 / 230 },
  /** ACOB LIGHTING wordmark, white text + anniversary seal — for dark/green backgrounds. */
  acobInverse: { path: "/images/exports/acob-lighting-inverse.png", ratio: 460 / 120 },
  /** Matrix "MA" mark, dark text — for white/light backgrounds. */
  matrixMark: { path: "/images/exports/matrix-mark.png", ratio: 320 / 233 },
  /** Matrix "MA" mark, flat white M + green A — for dark/deep-green backgrounds. */
  matrixMarkInverse: { path: "/images/exports/matrix-mark-inverse.png", ratio: 320 / 233 },
} as const

export type ExportLogo = (typeof EXPORT_LOGOS)[keyof typeof EXPORT_LOGOS]

/** Box of the given height, width derived from the asset's true aspect ratio. */
export const logoBoxByHeight = (logo: ExportLogo, h: number) => ({ w: Number((h * logo.ratio).toFixed(3)), h })

/** Box of the given width, height derived from the asset's true aspect ratio. */
export const logoBoxByWidth = (logo: ExportLogo, w: number) => ({ w, h: Number((w / logo.ratio).toFixed(3)) })

export type WeeklyPptxTheme = "light" | "dark"
export type WeeklyDeptOrder = "default" | "alpha" | "random"
