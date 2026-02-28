import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { saveAs } from "file-saver"
import {
  Document,
  Footer,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
} from "docx"

// Load pptxgenjs via a script tag (the correct browser usage pattern).
// The UMD bundle sets window.PptxGenJS as a side effect, bypassing all webpack issues.
// This avoids the "JSZip is not defined" error that occurs when webpack processes the UMD bundle.
const loadPptxGenJS = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    // Already loaded
    if (typeof (window as any).PptxGenJS === "function") {
      return resolve((window as any).PptxGenJS)
    }
    const script = document.createElement("script")
    script.src = "https://cdn.jsdelivr.net/npm/pptxgenjs@4/dist/pptxgen.bundle.js"
    script.onload = () => {
      if (typeof (window as any).PptxGenJS === "function") {
        resolve((window as any).PptxGenJS)
      } else {
        reject(new Error("PptxGenJS not found on window after script load"))
      }
    }
    script.onerror = () => reject(new Error("Failed to load pptxgenjs from CDN"))
    document.head.appendChild(script)
  })
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
  profiles?: any
}

// ─── Constants & Sorting ──────────────────────────────────────────────────
export const DEPARTMENT_ORDER = [
  "Accounts",
  "Business, Growth and Innovation",
  "Executive Management",
  "IT and Communications",
  "Admin & HR",
  "Legal, Regulatory and Compliance",
  "Operations",
  "Technical",
]

/**
 * Normalizes department name for comparison
 */
const normalizeDept = (dept: string) => {
  return dept
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\./g, "") // Remove dots
    .replace(/coms/g, "communications")
    .replace(/operation/g, "operations") // Standardize to plural
    .replace(/growth.*/, "growth") // Match "Business growth..."
    .replace(/legal,?\s*/, "") // Remove "Legal, " prefix if present
    .trim()
}

const NORMALIZED_ORDER = DEPARTMENT_ORDER.map(normalizeDept)

/**
 * Sorts reports based on the official ACOB department hierarchy.
 * Departments not in the list appear alphabetically at the end.
 */
export const sortReportsByDepartment = (reports: WeeklyReport[]) => {
  return [...reports].sort((a, b) => {
    const normA = normalizeDept(a.department)
    const normB = normalizeDept(b.department)

    const indexA = NORMALIZED_ORDER.findIndex((d) => normA.includes(d) || d.includes(normA))
    const indexB = NORMALIZED_ORDER.findIndex((d) => normB.includes(d) || d.includes(normB))

    if (indexA !== -1 && indexB !== -1) return indexA - indexB
    if (indexA !== -1) return -1
    if (indexB !== -1) return 1
    return a.department.localeCompare(b.department)
  })
}

/**
 * Auto-numbers each non-empty line: "1. line", "2. line", ...
 * If lines already start with "1. " numbering is preserved.
 */
export const autoNumberLines = (text: string): string => {
  if (!text?.trim()) return text || ""
  const lines = text.split("\n").filter((l) => l.trim().length > 0)
  if (lines[0]?.match(/^\d+\.\s/)) return text // already numbered
  return lines.map((l, i) => `${i + 1}. ${l.trim()}`).join("\n")
}

/** Returns the Monday date of a given ISO week as a formatted string e.g. "Monday, 17th February 2026" */
const getWeekMonday = (week: number, year: number): string => {
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = jan4.getDay() || 7
  const week1Monday = new Date(jan4)
  week1Monday.setDate(jan4.getDate() - (dayOfWeek - 1))
  const monday = new Date(week1Monday)
  monday.setDate(week1Monday.getDate() + (week - 1) * 7)
  const day = monday.getDate()
  const suffix =
    day === 1 || day === 21 || day === 31
      ? "st"
      : day === 2 || day === 22
        ? "nd"
        : day === 3 || day === 23
          ? "rd"
          : "th"
  const monthName = monday.toLocaleString("en-GB", { month: "long" })
  return `Monday, ${day}${suffix} ${monthName} ${monday.getFullYear()}`
}

/**
 * Fetches an image URL and returns a crisp PNG data URL via an offscreen canvas.
 * WebP fed directly to jsPDF renders poorly — converting to PNG via canvas fixes it.
 * Uses 2× scale for retina-quality output.
 */
const fetchImageAsBase64 = (url: string): Promise<string | null> =>
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
const PDF_GREEN: [number, number, number] = [26, 122, 74]
const PDF_DARK: [number, number, number] = [15, 45, 31]
const PDF_SLATE: [number, number, number] = [51, 65, 85]
const PDF_MUTED: [number, number, number] = [100, 116, 139]
const PDF_WHITE: [number, number, number] = [255, 255, 255]
const PDF_BLUE: [number, number, number] = [29, 106, 150]
const PDF_RED: [number, number, number] = [185, 28, 28]

/** Draws the ACOB PDF cover page (A4: 210×297mm). */
const pdfCoverPage = (
  doc: jsPDF,
  week: number,
  year: number,
  mondayDate: string,
  logoFull: string | null,
  subtitle?: string
) => {
  const W = 210,
    H = 297
  const headerH = 18
  const footerH = 14

  // Dark header bar (blank — no text)
  doc.setFillColor(...PDF_DARK)
  doc.rect(0, 0, W, headerH, "F")
  // Green accent line under header
  doc.setFillColor(...PDF_GREEN)
  doc.rect(0, headerH, W, 2, "F")

  // Bottom green footer
  doc.setFillColor(...PDF_GREEN)
  doc.rect(0, H - footerH, W, footerH, "F")
  doc.setFontSize(8)
  doc.setTextColor(...PDF_WHITE)
  doc.setFont("helvetica", "normal")
  doc.text("Confidential — ACOB Internal Use Only", W / 2, H - 5, { align: "center" })

  // ── Vertically centre all content in the body area ────────────────────────
  const bodyTop = headerH + 2
  const bodyBottom = H - footerH
  const bodyH = bodyBottom - bodyTop

  // Measure total content height:
  // Logo: 22mm, gap: 8mm, divider: 1mm, gap: 10mm,
  // "General Meeting": ~10mm, gap: 6mm, "Weekly Report": ~7mm, gap: 8mm,
  // Pill: 9mm, gap: 8mm, date: ~5mm, [subtitle: 6mm]
  const logoH = 22
  const subtitleExtra = subtitle ? 10 : 0
  const totalContentH = logoH + 8 + 1 + 14 + 10 + 6 + 7 + 8 + 9 + 8 + 5 + subtitleExtra
  const startY = bodyTop + (bodyH - totalContentH) / 2

  // Logo centred
  const logoW = 100
  const logoX = (W - logoW) / 2
  const logoY = startY
  if (logoFull) {
    doc.addImage(logoFull, "PNG", logoX, logoY, logoW, logoH, "LOGO_FULL", "FAST")
  } else {
    doc.setFontSize(14)
    doc.setTextColor(...PDF_DARK)
    doc.setFont("helvetica", "bold")
    doc.text("ACOB LIGHTING TECHNOLOGY LIMITED", W / 2, logoY + 14, { align: "center" })
  }

  // Green divider below logo
  const dividerY = logoY + logoH + 8
  doc.setDrawColor(...PDF_GREEN)
  doc.setLineWidth(0.5)
  doc.line(30, dividerY, W - 30, dividerY)

  // "General Meeting"
  const titleY = dividerY + 14
  doc.setFontSize(28)
  doc.setTextColor(...PDF_DARK)
  doc.setFont("helvetica", "bold")
  doc.text("General Meeting", W / 2, titleY, { align: "center" })

  // "Weekly Report"
  doc.setFontSize(18)
  doc.setTextColor(...PDF_GREEN)
  doc.setFont("helvetica", "normal")
  doc.text("Weekly Report", W / 2, titleY + 10, { align: "center" })

  // Week pill
  const pillW = 36,
    pillH = 9
  const pillX = W / 2 - pillW / 2
  const pillY = titleY + 20
  doc.setFillColor(...PDF_GREEN)
  doc.roundedRect(pillX, pillY, pillW, pillH, 2, 2, "F")
  doc.setFontSize(11)
  doc.setTextColor(...PDF_WHITE)
  doc.setFont("helvetica", "bold")
  doc.text(`Week ${week}`, W / 2, pillY + 6.2, { align: "center" })

  // Monday date
  doc.setFontSize(11)
  doc.setTextColor(...PDF_MUTED)
  doc.setFont("helvetica", "normal")
  doc.text(mondayDate, W / 2, pillY + 18, { align: "center" })

  // Optional subtitle (dept name or "Action Tracker")
  if (subtitle) {
    doc.setFontSize(10)
    doc.setTextColor(...PDF_GREEN)
    doc.setFont("helvetica", "italic")
    doc.text(subtitle, W / 2, pillY + 28, { align: "center" })
  }
}

/** Draws a dept index page listing all departments with numbers. */
const pdfDeptIndexPage = (doc: jsPDF, departments: string[], week: number, year: number) => {
  const W = 210,
    H = 297

  // Header
  doc.setFillColor(...PDF_DARK)
  doc.rect(0, 0, W, 18, "F")
  doc.setFontSize(11)
  doc.setTextColor(...PDF_WHITE)
  doc.setFont("helvetica", "bold")
  doc.text("Departments in This Report", 14, 12)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.text(`Week ${week}, ${year}`, W - 14, 12, { align: "right" })

  // List
  let y = 36
  departments.forEach((dept, i) => {
    // Circle badge
    doc.setFillColor(...PDF_GREEN)
    doc.circle(20, y - 1.5, 4, "F")
    doc.setFontSize(8)
    doc.setTextColor(...PDF_WHITE)
    doc.setFont("helvetica", "bold")
    doc.text(`${i + 1}`, 20, y + 1, { align: "center" })

    // Dept name
    doc.setFontSize(12)
    doc.setTextColor(...PDF_DARK)
    doc.setFont("helvetica", "normal")
    doc.text(dept, 30, y + 1)
    doc.setFontSize(10)
    doc.setTextColor(...PDF_GREEN)
    doc.setFont("helvetica", "bold")
    doc.text(String(i + 3), W - 14, y + 1, { align: "right" })

    // Separator
    if (i < departments.length - 1) {
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.3)
      doc.line(14, y + 6, W - 14, y + 6)
    }
    y += 14
  })

  // Footer
  doc.setFillColor(...PDF_GREEN)
  doc.rect(0, H - 14, W, 14, "F")
  doc.setFontSize(8)
  doc.setTextColor(...PDF_WHITE)
  doc.setFont("helvetica", "normal")
  doc.text("Confidential — ACOB Internal Use Only", W / 2, H - 5, { align: "center" })
}

/** Draws a dept section header page (green full-bleed). */
const pdfDeptHeaderPage = (doc: jsPDF, department: string, submittedBy: string) => {
  const W = 210,
    H = 297
  doc.setFillColor(...PDF_GREEN)
  doc.rect(0, 0, W, H, "F")

  doc.setFontSize(28) // Slightly smaller to accommodate wrapping
  doc.setTextColor(...PDF_WHITE)
  doc.setFont("helvetica", "bold")

  // Split text to fit within page with margins
  const maxW = W - 40
  const lines = doc.splitTextToSize(department.toUpperCase(), maxW)
  const lineHeight = 12
  const totalLinesH = lines.length * lineHeight
  const startY = H / 2 - totalLinesH / 2

  doc.text(lines, 20, startY)

  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(1)
  doc.line(20, startY + totalLinesH + 4, 100, startY + totalLinesH + 4)

  // doc.setFontSize(11)
  // doc.setFont("helvetica", "normal")
  // doc.text(`Submitted by: ${submittedBy}`, 20, H / 2 + 14)
}

/** Draws the content page: 3 rows, 1 column — Work Done / Tasks for New Week / Challenges. */
const pdfContentPage = (
  doc: jsPDF,
  department: string,
  report: WeeklyReport,
  logoDark: string | null,
  pageNumber?: number
) => {
  const W = 210,
    H = 297
  const headerH = 18
  const footerH = 14

  // Dark header bar
  doc.setFillColor(...PDF_DARK)
  doc.rect(0, 0, W, headerH, "F")
  // Green accent line under header
  doc.setFillColor(...PDF_GREEN)
  doc.rect(0, headerH, W, 1.5, "F")

  // Dept name — top LEFT in header
  doc.setFontSize(9)
  doc.setTextColor(...PDF_WHITE)
  doc.setFont("helvetica", "bold")
  doc.text(department.toUpperCase(), 8, 11)

  // Logo — RIGHT in header, vertically centred
  if (logoDark) {
    const logoH = 9,
      logoW = 38
    const logoY = (headerH - logoH) / 2 // = 4.5mm — perfectly centred
    doc.addImage(logoDark, "PNG", W - logoW - 6, logoY, logoW, logoH, "LOGO_DARK", "FAST")
  }

  // Body: 3 equal rows stacked vertically
  const bodyStart = headerH + 4
  const footerStart = H - footerH
  const bodyH = footerStart - bodyStart
  const rowH = bodyH / 3
  const labelH = 8 // slightly taller label bar
  const padX = 14
  const innerW = W - padX * 2
  const fontSize = 10 // bigger body font
  const lineSpacing = 6 // more spacing between lines

  const sections = [
    { title: "WORK DONE", color: PDF_GREEN, text: autoNumberLines(report.work_done) || "No data provided." },
    {
      title: "TASKS FOR NEW WEEK",
      color: PDF_BLUE,
      text: autoNumberLines(report.tasks_new_week) || "No data provided.",
    },
    { title: "CHALLENGES", color: PDF_RED, text: autoNumberLines(report.challenges) || "No challenges reported." },
  ]

  const drawFittedSectionText = (text: string, x: number, y: number, width: number, availableH: number) => {
    const buildLinesWithIndent = (
      content: string,
      textWidth: number,
      numberIndentMm: number
    ): Array<{ text: string; indent: number }> => {
      const out: Array<{ text: string; indent: number }> = []
      const sourceLines = String(content || "").split("\n")
      sourceLines.forEach((rawLine) => {
        const line = rawLine.trim()
        if (!line) {
          out.push({ text: "", indent: 0 })
          return
        }
        const numbered = line.match(/^(\d+\.)\s+(.*)$/)
        if (!numbered) {
          const plainLines = doc.splitTextToSize(line, textWidth)
          plainLines.forEach((pl: string) => out.push({ text: pl, indent: 0 }))
          return
        }
        const numberToken = `${numbered[1]} `
        const bodyText = numbered[2] || ""
        const firstLineMaxW = Math.max(8, textWidth - numberIndentMm)
        const bodyLines = doc.splitTextToSize(bodyText, firstLineMaxW)
        if (!bodyLines.length) {
          out.push({ text: numberToken.trim(), indent: 0 })
          return
        }
        out.push({ text: `${numberToken}${bodyLines[0]}`, indent: 0 })
        bodyLines.slice(1).forEach((bl: string) => out.push({ text: bl, indent: numberIndentMm }))
      })
      return out
    }

    const tryConfigs = [
      { fontSize: 10, lineSpacing: 6 },
      { fontSize: 9, lineSpacing: 5.5 },
      { fontSize: 8.5, lineSpacing: 5 },
      { fontSize: 8, lineSpacing: 4.6 },
      { fontSize: 7.5, lineSpacing: 4.2 },
      { fontSize: 7, lineSpacing: 3.9 },
    ]

    for (const cfg of tryConfigs) {
      doc.setFontSize(cfg.fontSize)
      const numberIndentMm = Math.max(5.0, cfg.fontSize * 0.42 - 0.4)
      const lines = buildLinesWithIndent(text, width, numberIndentMm)
      const maxLines = Math.floor(availableH / cfg.lineSpacing)
      if (lines.length <= maxLines) {
        let ty = y
        lines.forEach((line) => {
          doc.text(line.text, x + line.indent, ty)
          ty += cfg.lineSpacing
        })
        return
      }
    }

    // Last fallback: render as much as possible and add continuation hint.
    doc.setFontSize(7)
    const lines = buildLinesWithIndent(text, width, 5.0)
    const maxLines = Math.max(1, Math.floor(availableH / 3.9) - 1)
    let ty = y
    lines.slice(0, maxLines).forEach((line) => {
      doc.text(line.text, x + line.indent, ty)
      ty += 3.9
    })
    doc.setTextColor(...PDF_RED)
    doc.text("... continued (content too long for one page layout)", x, Math.min(y + availableH, ty + 2))
    doc.setTextColor(...PDF_SLATE)
  }

  sections.forEach((s, i) => {
    const sectionTop = bodyStart + i * rowH

    // Label bar
    doc.setFillColor(...s.color)
    doc.rect(padX, sectionTop, innerW, labelH, "F")
    doc.setFontSize(9)
    doc.setTextColor(...PDF_WHITE)
    doc.setFont("helvetica", "bold")
    doc.text(s.title, padX + 3, sectionTop + 5.5)

    // Content text — larger font, more spacing
    doc.setFontSize(fontSize)
    doc.setTextColor(...PDF_SLATE)
    doc.setFont("helvetica", "normal")
    drawFittedSectionText(s.text, padX + 3, sectionTop + labelH + 6, innerW - 6, rowH - labelH - 6)

    // Row divider (not after last)
    if (i < 2) {
      doc.setDrawColor(200, 215, 225)
      doc.setLineWidth(0.3)
      doc.line(padX, sectionTop + rowH, W - padX, sectionTop + rowH)
    }
  })

  // Footer
  doc.setFillColor(...PDF_GREEN)
  doc.rect(0, H - footerH, W, footerH, "F")
  doc.setFontSize(8)
  doc.setTextColor(...PDF_WHITE)
  doc.setFont("helvetica", "normal")
  doc.text("Confidential — ACOB Internal Use Only", 14, H - 5)
  if (typeof pageNumber === "number") {
    doc.setFont("helvetica", "bold")
    doc.text(String(pageNumber), W / 2, H - 5, { align: "center" })
  }
}

export const exportToPDF = async (report: WeeklyReport) => {
  const doc = new jsPDF()
  // Cover shows the CURRENT week (week being reported IN = report week + 1)
  const currentWeek = report.week_number + 1
  const currentYear = currentWeek > 52 ? report.year + 1 : report.year
  const mondayDate = getWeekMonday(currentWeek, currentYear)

  const [logoFull, logoDark] = await Promise.all([
    fetchImageAsBase64("/images/acob-logo-light.webp"),
    fetchImageAsBase64("/images/acob-logo-dark.webp"),
  ])

  // Page 1 — Cover (shows current week / meeting date)
  pdfCoverPage(doc, currentWeek, currentYear, mondayDate, logoFull, report.department)

  // Page 2 — Content (no separate dept header page)
  doc.addPage()
  pdfContentPage(doc, report.department, report, logoDark)

  doc.save(`ACOB_Report_${report.department}_W${report.week_number}.pdf`)
}

export const exportAllToPDF = async (reports: WeeklyReport[], week: number, year: number) => {
  const doc = new jsPDF()
  const sortedReports = sortReportsByDepartment(reports)
  // Cover shows the CURRENT week (week being reported IN = report week + 1)
  const currentWeek = week + 1
  const currentYear = currentWeek > 52 ? year + 1 : year
  const mondayDate = getWeekMonday(currentWeek, currentYear)
  const departments = sortedReports.map((r) => r.department)

  const [logoFull, logoDark] = await Promise.all([
    fetchImageAsBase64("/images/acob-logo-light.webp"),
    fetchImageAsBase64("/images/acob-logo-dark.webp"),
  ])

  // Page 1 — Cover (current week / meeting date)
  pdfCoverPage(doc, currentWeek, currentYear, mondayDate, logoFull)

  // Page 2 — Dept index
  doc.addPage()
  pdfDeptIndexPage(doc, departments, week, year)

  sortedReports.forEach((report, idx) => {
    // Content page only — no separate green dept header page
    doc.addPage()
    pdfContentPage(doc, report.department, report, logoDark, idx + 3)
  })

  doc.save(`ACOB_Weekly_Reports_W${currentWeek}_${currentYear}.pdf`)
}

/**
 * Generates the weekly report PDF and returns it as a base64 string (for email attachment).
 */
export const exportAllToPDFBase64 = async (reports: WeeklyReport[], week: number, year: number): Promise<string> => {
  const doc = new jsPDF()
  const sortedReports = sortReportsByDepartment(reports)
  // Cover shows the CURRENT week (week being reported IN = report week + 1)
  const currentWeek = week + 1
  const currentYear = currentWeek > 52 ? year + 1 : year
  const mondayDate = getWeekMonday(currentWeek, currentYear)
  const departments = sortedReports.map((r) => r.department)

  const [logoFull, logoDark] = await Promise.all([
    fetchImageAsBase64("/images/acob-logo-light.webp"),
    fetchImageAsBase64("/images/acob-logo-dark.webp"),
  ])

  pdfCoverPage(doc, currentWeek, currentYear, mondayDate, logoFull)
  doc.addPage()
  pdfDeptIndexPage(doc, departments, week, year)

  sortedReports.forEach((report, idx) => {
    // No separate dept header page
    doc.addPage()
    pdfContentPage(doc, report.department, report, logoDark, idx + 3)
  })

  return doc.output("datauristring").split(",")[1]
}

// ─── Action Tracker PDF ───────────────────────────────────────────────────────

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

/** Draws a single Action Tracker content page for a department. */
const pdfActionTrackerPage = (
  doc: jsPDF,
  department: string,
  actions: ActionItem[],
  logoDark: string | null,
  week: number,
  year: number,
  pageNumber?: number
) => {
  const W = 210,
    H = 297
  const headerH = 18
  const footerH = 14

  // Dark header bar
  doc.setFillColor(...PDF_DARK)
  doc.rect(0, 0, W, headerH, "F")
  // Green accent line
  doc.setFillColor(...PDF_GREEN)
  doc.rect(0, headerH, W, 1.5, "F")

  // Dept name — top LEFT
  doc.setFontSize(9)
  doc.setTextColor(...PDF_WHITE)
  doc.setFont("helvetica", "bold")
  doc.text(department.toUpperCase(), 8, 11)

  // Logo — RIGHT, vertically centred
  if (logoDark) {
    const logoH = 9,
      logoW = 38
    const logoY = (headerH - logoH) / 2 // = 4.5mm
    doc.addImage(logoDark, "PNG", W - logoW - 6, logoY, logoW, logoH, "LOGO_DARK", "FAST")
  }

  // Week badge (below header)
  doc.setFillColor(...PDF_GREEN)
  doc.roundedRect(W - 14 - 30, headerH + 4, 30, 7, 1.5, 1.5, "F")
  doc.setFontSize(8)
  doc.setTextColor(...PDF_WHITE)
  doc.setFont("helvetica", "bold")
  doc.text(`Week ${week}, ${year}`, W - 14 - 15, headerH + 9, { align: "center" })

  // Section title
  doc.setFontSize(13)
  doc.setTextColor(...PDF_DARK)
  doc.setFont("helvetica", "bold")
  doc.text("ACTION TRACKER", 14, headerH + 18)
  doc.setDrawColor(...PDF_GREEN)
  doc.setLineWidth(0.5)
  doc.line(14, headerH + 20, W - 14, headerH + 20)

  // Column headers: S/N | ACTION ITEM | STATUS
  const snX = 14
  const snW = 12
  const actionX = snX + snW
  const statusW = 36
  const statusX = W - 14 - statusW
  const actionW = statusX - actionX
  const headerY = headerH + 28

  doc.setFillColor(...PDF_GREEN)
  doc.rect(14, headerY - 5, W - 28, 8, "F")
  doc.setFontSize(8)
  doc.setTextColor(...PDF_WHITE)
  doc.setFont("helvetica", "bold")
  doc.text("S/N", snX + 2, headerY)
  doc.text("ACTION ITEM", actionX + 2, headerY)
  doc.text("STATUS", statusX + 2, headerY)

  // Rows
  let rowTop = headerY + 3
  const minRowH = 10
  const titleLineH = 3.8
  const maxTitleLines = 3
  const statusColors: Record<string, [number, number, number]> = {
    completed: [22, 101, 52],
    in_progress: [29, 78, 216],
    not_started: [180, 83, 9],
    pending: [100, 116, 139],
  }
  const statusLabels: Record<string, string> = {
    completed: "Completed",
    in_progress: "In Progress",
    not_started: "Not Started",
    pending: "Pending",
  }

  actions.forEach((action, i) => {
    const titleLinesRaw = doc.splitTextToSize(action.title || "", actionW - 4)
    const titleLines = titleLinesRaw.slice(0, maxTitleLines)
    if (titleLinesRaw.length > maxTitleLines && titleLines.length > 0) {
      titleLines[titleLines.length - 1] = `${titleLines[titleLines.length - 1]}...`
    }
    const rowH = Math.max(minRowH, titleLines.length * titleLineH + 3)
    if (rowTop + rowH > H - footerH - 4) return // Overflow guard
    const isEven = i % 2 === 0
    if (isEven) {
      doc.setFillColor(248, 250, 252)
      doc.rect(14, rowTop, W - 28, rowH, "F")
    }

    // S/N
    doc.setFontSize(8)
    doc.setTextColor(...PDF_SLATE)
    doc.setFont("helvetica", "bold")
    doc.text(`${i + 1}`, snX + 4, rowTop + 5.5)

    // Action item — wrapped over multiple lines (up to maxTitleLines)
    doc.setFontSize(9)
    doc.setTextColor(...PDF_SLATE)
    doc.setFont("helvetica", "normal")
    titleLines.forEach((line: string, lineIdx: number) => {
      doc.text(line, actionX + 2, rowTop + 4.2 + lineIdx * titleLineH)
    })

    // Status badge
    const statusColor = statusColors[action.status] || statusColors.pending
    const statusLabel = statusLabels[action.status] || action.status
    doc.setFillColor(...statusColor)
    const badgeY = rowTop + Math.max(0.8, (rowH - 6) / 2)
    doc.roundedRect(statusX + 1, badgeY, statusW - 2, 6, 1, 1, "F")
    doc.setTextColor(...PDF_WHITE)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7)
    doc.text(statusLabel, statusX + statusW / 2, badgeY + 4.1, { align: "center" })

    // Separator
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.2)
    doc.line(14, rowTop + rowH, W - 14, rowTop + rowH)

    rowTop += rowH
  })

  // Footer
  doc.setFillColor(...PDF_GREEN)
  doc.rect(0, H - footerH, W, footerH, "F")
  doc.setFontSize(8)
  doc.setTextColor(...PDF_WHITE)
  doc.setFont("helvetica", "normal")
  doc.text("Confidential — ACOB Internal Use Only", 14, H - 5)
  if (typeof pageNumber === "number") {
    doc.setFont("helvetica", "bold")
    doc.text(String(pageNumber), W / 2, H - 5, { align: "center" })
  }
}

/**
 * Generates the Action Tracker PDF and returns it as a base64 string (for email attachment).
 */
export const exportActionTrackerToPDFBase64 = async (
  actions: ActionItem[],
  week: number,
  year: number
): Promise<string> => {
  const doc = new jsPDF()
  // Action Tracker week IS the current week (no +1 needed)
  const mondayDate = getWeekMonday(week, year)

  const [logoFull, logoDark] = await Promise.all([
    fetchImageAsBase64("/images/acob-logo-light.webp"),
    fetchImageAsBase64("/images/acob-logo-dark.webp"),
  ])

  // Cover page — shows current week with "Action Tracker" subtitle
  pdfCoverPage(doc, week, year, mondayDate, logoFull, "Action Tracker")

  // Group actions by department (in DEPARTMENT_ORDER)
  const grouped: Record<string, ActionItem[]> = {}
  actions.forEach((a) => {
    if (!grouped[a.department]) grouped[a.department] = []
    grouped[a.department].push(a)
  })

  const departments = DEPARTMENT_ORDER.filter((d) => grouped[d])
  Object.keys(grouped).forEach((d) => {
    if (!departments.includes(d)) departments.push(d)
  })

  // Page 2 — Dept index / TOC
  doc.addPage()
  pdfDeptIndexPage(doc, departments, week, year)

  departments.forEach((dept, idx) => {
    const deptActions = grouped[dept] || []
    doc.addPage()
    pdfActionTrackerPage(doc, dept, deptActions, logoDark, week, year, idx + 3)
  })

  return doc.output("datauristring").split(",")[1]
}

/**
 * Saves the Action Tracker as a downloadable PDF file.
 */
export const exportActionTrackerToPDF = async (actions: ActionItem[], week: number, year: number): Promise<void> => {
  const base64 = await exportActionTrackerToPDFBase64(actions, week, year)
  const blob = new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], { type: "application/pdf" })
  saveAs(blob, `ACOB_Action_Tracker_W${week}_${year}.pdf`)
}

/**
 * Exports the Action Tracker as a PPTX presentation.
 */
export const exportActionTrackerToPPTX = async (actions: ActionItem[], week: number, year: number): Promise<void> => {
  const PptxConstructor = await loadPptxGenJS()
  const pres = new PptxConstructor()
  pres.layout = "LAYOUT_WIDE"

  // Cover slide
  addCoverSlide(pres, week, year, "Action Tracker")

  // Group by department
  const grouped: Record<string, ActionItem[]> = {}
  actions.forEach((a) => {
    if (!grouped[a.department]) grouped[a.department] = []
    grouped[a.department].push(a)
  })

  const departments = DEPARTMENT_ORDER.filter((d) => grouped[d])
  Object.keys(grouped).forEach((d) => {
    if (!departments.includes(d)) departments.push(d)
  })

  // TOC slide
  addDeptIndexSlide(pres, departments, week, year)

  departments.forEach((dept, idx) => {
    const deptActions = grouped[dept] || []
    const slide = pres.addSlide()
    slide.background = { color: ACOB_OFFWHITE }

    // Header
    slide.addShape(pres.ShapeType?.rect ?? "rect", {
      x: 0,
      y: 0,
      w: "100%",
      h: 0.65,
      fill: { color: ACOB_DARK },
      line: { color: ACOB_DARK },
    })
    slide.addText(dept.toUpperCase(), {
      x: 0.3,
      y: 0,
      w: 9,
      h: 0.65,
      fontSize: 14,
      bold: true,
      color: ACOB_WHITE,
      valign: "middle",
      fontFace: "Calibri",
    })
    try {
      slide.addImage({ path: LOGO_ICON, x: 11.45, y: 0.14, w: 1.7, h: 0.37 })
    } catch {
      /* skip */
    }

    // Week badge
    slide.addText(`Week ${week}, ${year}`, {
      x: 9.5,
      y: 0.7,
      w: 3.5,
      h: 0.35,
      fontSize: 10,
      bold: true,
      color: ACOB_WHITE,
      fill: { color: ACOB_GREEN },
      align: "center",
      valign: "middle",
      fontFace: "Calibri",
    })

    // Table header: S/N | ACTION ITEM | STATUS
    const tableY = 1.2
    const colWidths = [0.8, 9.2, 2.8]
    const headers = ["S/N", "ACTION ITEM", "STATUS"]
    const colX = [0.25, 1.05, 10.25]

    slide.addShape(pres.ShapeType?.rect ?? "rect", {
      x: 0.25,
      y: tableY,
      w: 12.83,
      h: 0.38,
      fill: { color: ACOB_GREEN },
      line: { color: ACOB_GREEN },
    })
    headers.forEach((h, i) => {
      slide.addText(h, {
        x: colX[i] + 0.1,
        y: tableY,
        w: colWidths[i] - 0.1,
        h: 0.38,
        fontSize: 9,
        bold: true,
        color: ACOB_WHITE,
        valign: "middle",
        fontFace: "Calibri",
      })
    })

    const statusColors: Record<string, string> = {
      completed: "166534",
      in_progress: "1D4ED8",
      not_started: "C2410C",
      pending: "64748B",
    }
    const statusLabels: Record<string, string> = {
      completed: "Completed",
      in_progress: "In Progress",
      not_started: "Not Started",
      pending: "Pending",
    }

    let rowY = tableY + 0.38
    const rowH = 0.38
    deptActions.slice(0, 14).forEach((action, i) => {
      const bg = i % 2 === 0 ? "F8FAFB" : ACOB_WHITE
      slide.addShape(pres.ShapeType?.rect ?? "rect", {
        x: 0.25,
        y: rowY,
        w: 12.83,
        h: rowH,
        fill: { color: bg },
        line: { color: "E2E8F0", width: 0.5 },
      })
      // S/N
      slide.addText(`${i + 1}`, {
        x: colX[0] + 0.1,
        y: rowY,
        w: colWidths[0] - 0.1,
        h: rowH,
        fontSize: 10,
        bold: true,
        color: ACOB_SLATE,
        valign: "middle",
        fontFace: "Calibri",
      })
      // Action item — full width, no truncation
      slide.addText(action.title, {
        x: colX[1] + 0.1,
        y: rowY,
        w: colWidths[1] - 0.1,
        h: rowH,
        fontSize: 10,
        color: ACOB_SLATE,
        valign: "middle",
        fontFace: "Calibri",
      })
      const sc = statusColors[action.status] || statusColors.pending
      const sl = statusLabels[action.status] || action.status
      slide.addText(sl, {
        x: colX[2] + 0.1,
        y: rowY + 0.05,
        w: colWidths[2] - 0.2,
        h: rowH - 0.1,
        fontSize: 9,
        bold: true,
        color: ACOB_WHITE,
        fill: { color: sc },
        align: "center",
        valign: "middle",
        fontFace: "Calibri",
      })
      rowY += rowH
    })

    // Footer
    slide.addShape(pres.ShapeType?.rect ?? "rect", {
      x: 0,
      y: 6.9,
      w: "100%",
      h: 0.6,
      fill: { color: ACOB_GREEN },
      line: { color: ACOB_GREEN },
    })
    const nextDept = departments[idx + 1]
    if (nextDept) {
      slide.addText(`NEXT: ${nextDept}`, {
        x: 7,
        y: 6.9,
        w: 6.1,
        h: 0.6,
        fontSize: 10,
        color: ACOB_WHITE,
        align: "right",
        valign: "middle",
        fontFace: "Calibri",
        bold: true,
      })
    }
    slide.addText(String(idx + 3), {
      x: 0,
      y: 6.9,
      w: "100%",
      h: 0.6,
      fontSize: 10,
      color: ACOB_WHITE,
      align: "center",
      valign: "middle",
      fontFace: "Calibri",
      bold: true,
    })
  })

  await pres.writeFile({ fileName: `ACOB_Action_Tracker_W${week}_${year}.pptx` })
}

// ─── DOCX helpers ─────────────────────────────────────────────────────────────

/** Returns a heading paragraph with coloured text + underline (no shaded background). */
const docxSectionHeading = (title: string, hexBg: string) =>
  new Paragraph({
    children: [
      new TextRun({
        text: title,
        bold: true,
        color: hexBg,
        size: 22,
      }),
    ],
    border: { bottom: { color: hexBg, size: 8, style: "single" } },
    spacing: { before: 200, after: 80 },
  })

/** Converts text to numbered Paragraph array. */
const docxNumberedItems = (text: string, fallback: string) => {
  const lines = text?.split("\n").filter(Boolean) ?? []
  if (lines.length === 0) return [new Paragraph({ text: fallback, spacing: { after: 60 } })]
  return lines.map(
    (l, i) =>
      new Paragraph({
        children: [new TextRun(`${i + 1}. ${l.trim()}`)],
        indent: { left: 480, hanging: 360 },
        spacing: { after: 60 },
      })
  )
}

export const exportToDocx = async (report: WeeklyReport) => {
  const p = Array.isArray(report.profiles) ? report.profiles[0] : report.profiles
  const name = p ? `${p.first_name} ${p.last_name}` : "Employee"
  const mondayDate = getWeekMonday(report.week_number, report.year)

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "ACOB LIGHTING TECHNOLOGY LIMITED", bold: true, size: 36, color: "1A7A4A" }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "General Meeting  ·  Weekly Report", size: 26, color: "334155" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Week ${report.week_number}  ·  ${report.year}`,
                bold: true,
                size: 22,
                color: "1A7A4A",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [new TextRun({ text: mondayDate, size: 20, color: "64748B" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [new TextRun({ text: report.department, italics: true, size: 20, color: "1A7A4A" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Department", bold: true })] })],
                    width: { size: 30, type: WidthType.PERCENTAGE },
                  }),
                  new TableCell({ children: [new Paragraph(report.department)] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Employee", bold: true })] })],
                  }),
                  new TableCell({ children: [new Paragraph(name)] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Period", bold: true })] })],
                  }),
                  new TableCell({ children: [new Paragraph(`Week ${report.week_number}, ${report.year}`)] }),
                ],
              }),
            ],
          }),
          new Paragraph({ text: "", spacing: { after: 200 } }),
          docxSectionHeading("WORK DONE", "1A7A4A"),
          ...docxNumberedItems(report.work_done, "No data provided."),
          new Paragraph({ text: "", spacing: { after: 120 } }),
          docxSectionHeading("TASKS FOR NEW WEEK", "1D6A96"),
          ...docxNumberedItems(report.tasks_new_week, "No data provided."),
          new Paragraph({ text: "", spacing: { after: 120 } }),
          docxSectionHeading("CHALLENGES", "B91C1C"),
          ...docxNumberedItems(report.challenges, "No challenges reported."),
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `ACOB_Report_${report.department}_W${report.week_number}.docx`)
}

/**
 * Exports the Action Tracker to a DOCX document.
 */
export const exportActionTrackerToDocx = async (actions: ActionItem[], week: number, year: number) => {
  const mondayDate = getWeekMonday(week, year)

  const docSize = { width: 11906, height: 16838 } // A4 in twips

  const grouped: Record<string, ActionItem[]> = {}
  actions.forEach((a) => {
    if (!grouped[a.department]) grouped[a.department] = []
    grouped[a.department].push(a)
  })
  const departments = DEPARTMENT_ORDER.filter((d) => grouped[d])
  Object.keys(grouped).forEach((d) => {
    if (!departments.includes(d)) departments.push(d)
  })

  const pageFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT] })],
      }),
    ],
  })

  const tocRows = departments.map(
    (dept, i) =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(dept)] }),
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun(String(i + 3))] })],
          }),
        ],
      })
  )

  const deptChildren: any[] = []
  departments.forEach((dept, i) => {
    const deptActions = grouped[dept] || []
    deptChildren.push(
      new Paragraph({
        children: [new TextRun({ text: dept.toUpperCase(), bold: true, size: 28, color: "1A7A4A" })],
        pageBreakBefore: i > 0,
        spacing: { after: 100 },
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({ children: [new TextRun({ text: "ACTION ITEM", bold: true, color: "FFFFFF" })] }),
                ],
                shading: { type: ShadingType.SOLID, color: "1A7A4A", fill: "1A7A4A" },
                width: { size: 75, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "STATUS", bold: true, color: "FFFFFF" })] })],
                shading: { type: ShadingType.SOLID, color: "1A7A4A", fill: "1A7A4A" },
                width: { size: 25, type: WidthType.PERCENTAGE },
              }),
            ],
          }),
          ...deptActions.map(
            (a) =>
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph(a.title)] }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: a.status.replace("_", " ").toUpperCase(), bold: true })],
                      }),
                    ],
                  }),
                ],
              })
          ),
        ],
      }),
      new Paragraph({ text: "", spacing: { after: 120 } })
    )
  })

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "ACOB LIGHTING TECHNOLOGY LIMITED", bold: true, size: 36, color: "1A7A4A" }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "General Meeting  ·  Action Tracker", size: 26, color: "334155" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `Week ${week}  ·  ${year}`, bold: true, size: 22, color: "1A7A4A" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [new TextRun({ text: mondayDate, size: 20, color: "64748B" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Departments in This Report", bold: true, size: 24, color: "0F2D1F" })],
            spacing: { after: 100 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tocRows,
          }),
        ],
      },
      {
        properties: { page: { pageNumbers: { start: 3 } } },
        footers: { default: pageFooter },
        children: deptChildren,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `ACOB_Action_Tracker_W${week}_${year}.docx`)
}

export const exportAllToDocx = async (reports: WeeklyReport[], week: number, year: number) => {
  const sortedReports = sortReportsByDepartment(reports)
  const mondayDate = getWeekMonday(week, year)

  const tocChildren: any[] = [
    new Paragraph({
      children: [new TextRun({ text: "ACOB LIGHTING TECHNOLOGY LIMITED", bold: true, size: 36, color: "1A7A4A" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "General Meeting  ·  Weekly Report", size: 26, color: "334155" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Week ${week}  ·  ${year}`, bold: true, size: 22, color: "1A7A4A" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: mondayDate, size: 20, color: "64748B" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Departments in This Report", bold: true, size: 24, color: "0F2D1F" })],
      spacing: { after: 100 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: sortedReports.map(
        (r, i) =>
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph(r.department)] }),
              new TableCell({
                width: { size: 15, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun(String(i + 3))] })],
              }),
            ],
          })
      ),
    }),
  ]

  const reportChildren: any[] = []
  sortedReports.forEach((report, idx) => {
    reportChildren.push(
      new Paragraph({
        children: [new TextRun({ text: report.department.toUpperCase(), bold: true, size: 32, color: "FFFFFF" })],
        shading: { type: ShadingType.SOLID, color: "1A7A4A", fill: "1A7A4A" },
        pageBreakBefore: idx > 0,
        spacing: { after: 80 },
      }),
      docxSectionHeading("WORK DONE", "1A7A4A"),
      ...docxNumberedItems(report.work_done, "No data provided."),
      new Paragraph({ text: "", spacing: { after: 120 } }),
      docxSectionHeading("TASKS FOR NEW WEEK", "1D6A96"),
      ...docxNumberedItems(report.tasks_new_week, "No data provided."),
      new Paragraph({ text: "", spacing: { after: 120 } }),
      docxSectionHeading("CHALLENGES", "B91C1C"),
      ...docxNumberedItems(report.challenges, "No challenges reported."),
      new Paragraph({ text: "", spacing: { after: 120 } })
    )
  })

  const pageFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT] })],
      }),
    ],
  })

  const doc = new Document({
    sections: [
      { children: tocChildren },
      {
        properties: { page: { pageNumbers: { start: 3 } } },
        footers: { default: pageFooter },
        children: reportChildren,
      },
    ],
  })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `ACOB_Weekly_Reports_All_W${week}_${year}.docx`)
}

// ─── ACOB PPTX Design Helpers ────────────────────────────────────────────────
// ACOB brand colours
const ACOB_GREEN = "1A7A4A" // primary green
const ACOB_GREEN_LIGHT = "E8F5EE" // light green tint
const ACOB_DARK = "0F2D1F" // deep dark green
const ACOB_SLATE = "334155"
const ACOB_MUTED = "64748B"
const ACOB_WHITE = "FFFFFF"
const ACOB_OFFWHITE = "F8FAF9"

// Logo URLs
// acob-logo-light.webp = full colour logo (dark text + green) — use on light/white backgrounds
// acob-logo-dark.webp  = green-only minimal logo — use on dark/green backgrounds
const LOGO_FULL = "/images/acob-logo-light.webp" // full ACOB LIGHTING logo
const LOGO_ICON = "/images/acob-logo-dark.webp" // green-only icon variant

/** Adds the ACOB cover slide. */
const addCoverSlide = (pres: any, week: number, year: number, subtitle?: string) => {
  const slide = pres.addSlide()

  // White body, dark header/footer only
  slide.background = { color: ACOB_WHITE }

  // ── Top dark header bar ───────────────────────────────────────────────────
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: 0,
    y: 0,
    w: "100%",
    h: 0.55,
    fill: { color: ACOB_DARK },
    line: { color: ACOB_DARK },
  })
  // thin green accent under header
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: 0,
    y: 0.55,
    w: "100%",
    h: 0.06,
    fill: { color: ACOB_GREEN },
    line: { color: ACOB_GREEN },
  })

  // ── Centred logo (full ACOB LIGHTING logo) ────────────────────────────────
  // Logo natural ratio ≈ 4.6 : 1  →  w=4.6, h=1.0
  // Slide body: y=0.61 → y=6.9  (height = 6.29")
  // Full visual block height:
  //   logo(1.0) + gap(0.25) + divider(0) + gap(0.2) + GM(0.7) + gap(0.12) + WR(0.55) + gap(0.2) + pill(0.42) + gap(0.18) + date(0.45) = 4.07
  //   (+ subtitle 0.5 if present, but centre without it)
  // Block start = bodyCentre - blockH/2 = (0.61 + 6.29/2) - 4.07/2 = 3.755 - 2.035 = 1.72
  const blockStart = 1.72
  const logoW = 4.6
  const logoH = 1.0
  const logoX = (13.33 - logoW) / 2
  try {
    slide.addImage({
      path: LOGO_FULL,
      x: logoX,
      y: blockStart,
      w: logoW,
      h: logoH,
    })
  } catch {
    slide.addText("ACOB LIGHTING TECHNOLOGY LIMITED", {
      x: 0.5,
      y: blockStart,
      w: 12.33,
      h: logoH,
      fontSize: 22,
      bold: true,
      color: ACOB_DARK,
      align: "center",
      fontFace: "Calibri",
    })
  }

  // ── Green divider ─────────────────────────────────────────────────────────
  slide.addShape(pres.ShapeType?.line ?? "line", {
    x: 1.5,
    y: blockStart + 1.35,
    w: 10.33,
    h: 0,
    line: { color: ACOB_GREEN, width: 1.5 },
  })

  // ── Main title block ──────────────────────────────────────────────────────
  const titleStart = blockStart + 1.55

  // "General Meeting"
  slide.addText("General Meeting", {
    x: 0.5,
    y: titleStart,
    w: 12.33,
    h: 0.7,
    fontSize: 40,
    bold: true,
    color: ACOB_DARK,
    align: "center",
    fontFace: "Calibri",
  })

  // "Weekly Report"
  slide.addText("Weekly Report", {
    x: 0.5,
    y: titleStart + 0.82,
    w: 12.33,
    h: 0.55,
    fontSize: 26,
    bold: false,
    color: ACOB_GREEN,
    align: "center",
    fontFace: "Calibri",
  })

  // "Week N" pill
  const weekLabel = `Week ${week}`
  slide.addText(weekLabel, {
    x: 5.4,
    y: titleStart + 1.57,
    w: 2.53,
    h: 0.42,
    fontSize: 15,
    bold: true,
    color: ACOB_WHITE,
    fill: { color: ACOB_GREEN },
    align: "center",
    valign: "middle",
    fontFace: "Calibri",
  })

  // Monday date
  const mondayDate = getWeekMonday(week, year)
  slide.addText(mondayDate, {
    x: 0.5,
    y: titleStart + 2.15,
    w: 12.33,
    h: 0.45,
    fontSize: 16,
    bold: false,
    color: ACOB_MUTED,
    align: "center",
    fontFace: "Calibri",
  })

  // Optional subtitle (dept name for single-report export)
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5,
      y: titleStart + 2.7,
      w: 12.33,
      h: 0.4,
      fontSize: 14,
      bold: false,
      color: ACOB_GREEN,
      align: "center",
      fontFace: "Calibri",
      italic: true,
    })
  }

  // ── Bottom green strip ────────────────────────────────────────────────────
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: 0,
    y: 6.9,
    w: "100%",
    h: 0.6,
    fill: { color: ACOB_GREEN },
    line: { color: ACOB_GREEN },
  })
  slide.addText("Confidential — ACOB Internal Use Only", {
    x: 0,
    y: 6.9,
    w: "100%",
    h: 0.6,
    fontSize: 10,
    color: ACOB_WHITE,
    align: "center",
    valign: "middle",
    fontFace: "Calibri",
  })

  return slide
}

/**
 * Adds a department title slide (full-bleed green).
 */
const addDeptTitleSlide = (pres: any, department: string, submittedBy: string, pageNumber?: number) => {
  const slide = pres.addSlide()
  slide.background = { color: ACOB_GREEN }

  // Subtle top-right circle decoration
  slide.addShape(pres.ShapeType?.ellipse ?? "ellipse", {
    x: 10.5,
    y: -1.2,
    w: 4,
    h: 4,
    fill: { color: ACOB_DARK, transparency: 60 },
    line: { color: ACOB_DARK, transparency: 60 },
  })

  slide.addText(department.toUpperCase(), {
    x: 0.6,
    y: 2.4,
    w: 12,
    h: 1.2,
    fontSize: 48,
    bold: true,
    color: ACOB_WHITE,
    fontFace: "Calibri",
    align: "left",
  })

  slide.addShape(pres.ShapeType?.line ?? "line", {
    x: 0.6,
    y: 3.7,
    w: 5,
    h: 0,
    line: { color: ACOB_WHITE, width: 2, transparency: 40 },
  })

  // slide.addText(`Submitted by: ${submittedBy}`, {
  //     x: 0.6, y: 3.9, w: 12, h: 0.4,
  //     fontSize: 16, color: ACOB_WHITE,
  //     fontFace: "Calibri",
  //     transparency: 20,
  // })

  if (typeof pageNumber === "number") {
    slide.addText(String(pageNumber), {
      x: 0,
      y: 6.9,
      w: "100%",
      h: 0.5,
      fontSize: 10,
      bold: true,
      color: ACOB_WHITE,
      align: "center",
      valign: "middle",
      fontFace: "Calibri",
    })
  }

  return slide
}

/**
 * Adds a numbered department index slide (shown after the cover in bulk export).
 */
const addDeptIndexSlide = (
  pres: any,
  departments: string[],
  week: number,
  year: number,
  pageNumberForDepartment: (index: number) => number = (index) => index + 3
) => {
  const slide = pres.addSlide()
  slide.background = { color: ACOB_OFFWHITE }

  // Header
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: 0,
    y: 0,
    w: "100%",
    h: 0.65,
    fill: { color: ACOB_DARK },
    line: { color: ACOB_DARK },
  })
  slide.addText("Departments in This Report", {
    x: 0.3,
    y: 0,
    w: 10,
    h: 0.65,
    fontSize: 16,
    bold: true,
    color: ACOB_WHITE,
    valign: "middle",
    fontFace: "Calibri",
  })
  slide.addText(`Week ${week}, ${year}`, {
    x: 10,
    y: 0,
    w: 3,
    h: 0.65,
    fontSize: 12,
    color: ACOB_GREEN_LIGHT,
    valign: "middle",
    align: "right",
    fontFace: "Calibri",
  })

  // Numbered list
  const startY = 1.0
  const rowH = 0.5
  departments.forEach((dept, i) => {
    const y = startY + i * rowH
    // Number badge
    slide.addShape(pres.ShapeType?.ellipse ?? "ellipse", {
      x: 0.5,
      y: y + 0.05,
      w: 0.38,
      h: 0.38,
      fill: { color: ACOB_GREEN },
      line: { color: ACOB_GREEN },
    })
    slide.addText(`${i + 1}`, {
      x: 0.5,
      y: y + 0.05,
      w: 0.38,
      h: 0.38,
      fontSize: 11,
      bold: true,
      color: ACOB_WHITE,
      align: "center",
      valign: "middle",
      fontFace: "Calibri",
    })
    slide.addText(dept, {
      x: 1.05,
      y: y,
      w: 10.5,
      h: 0.45,
      fontSize: 16,
      color: ACOB_DARK,
      valign: "middle",
      fontFace: "Calibri",
    })
    slide.addText(String(pageNumberForDepartment(i)), {
      x: 11.5,
      y: y,
      w: 1.3,
      h: 0.45,
      fontSize: 14,
      bold: true,
      color: ACOB_GREEN,
      valign: "middle",
      align: "right",
      fontFace: "Calibri",
    })
    // subtle separator line
    if (i < departments.length - 1) {
      slide.addShape(pres.ShapeType?.line ?? "line", {
        x: 0.5,
        y: y + rowH - 0.05,
        w: 12.3,
        h: 0,
        line: { color: "E2E8F0", width: 0.5 },
      })
    }
  })

  // Bottom strip
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: 0,
    y: 6.9,
    w: "100%",
    h: 0.6,
    fill: { color: ACOB_GREEN },
    line: { color: ACOB_GREEN },
  })
  return slide
}

const wrapTextByChars = (text: string, maxCharsPerLine: number): string[] => {
  const sourceLines = String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
  const wrapped: string[] = []

  const wrapPlainLine = (line: string, limit: number): string[] => {
    if (!line) return [""]
    if (line.length <= limit) return [line]
    const words = line.split(/\s+/)
    const out: string[] = []
    let current = ""
    words.forEach((w) => {
      const candidate = current ? `${current} ${w}` : w
      if (candidate.length <= limit) {
        current = candidate
      } else {
        if (current) out.push(current)
        if (w.length > limit) {
          for (let i = 0; i < w.length; i += limit) out.push(w.slice(i, i + limit))
          current = ""
        } else {
          current = w
        }
      }
    })
    if (current) out.push(current)
    return out
  }

  sourceLines.forEach((raw) => {
    const line = raw.trimEnd()
    if (!line) {
      wrapped.push("")
      return
    }
    const numberedMatch = line.match(/^(\d+\.)\s+(.*)$/)
    if (!numberedMatch) {
      wrapped.push(...wrapPlainLine(line, maxCharsPerLine))
      return
    }

    const prefix = `${numberedMatch[1]} `
    const body = numberedMatch[2] || ""
    const bodyLimit = Math.max(10, maxCharsPerLine - prefix.length)
    const bodyLines = wrapPlainLine(body, bodyLimit)
    if (bodyLines.length === 0) {
      wrapped.push(prefix.trimEnd())
      return
    }
    wrapped.push(prefix + bodyLines[0])
    const continuationPad = " ".repeat(prefix.length + 1)
    for (let i = 1; i < bodyLines.length; i++) {
      wrapped.push(continuationPad + bodyLines[i])
    }
  })

  return wrapped
}

const fitTextToPptxBox = (
  text: string,
  boxWIn: number,
  boxHIn: number,
  preferredFont = 11,
  minFont = 7
): { text: string; fontSize: number } => {
  const lineHeightRatio = 1.25
  const avgCharWidthRatio = 0.56

  for (let fontSize = preferredFont; fontSize >= minFont; fontSize -= 0.5) {
    const charsPerLine = Math.max(10, Math.floor((boxWIn * 72) / (fontSize * avgCharWidthRatio)))
    const maxLines = Math.max(1, Math.floor((boxHIn * 72) / (fontSize * lineHeightRatio)))
    const lines = wrapTextByChars(text, charsPerLine)
    if (lines.length <= maxLines) {
      return { text: lines.join("\n"), fontSize }
    }
  }

  const finalSize = minFont
  const charsPerLine = Math.max(10, Math.floor((boxWIn * 72) / (finalSize * avgCharWidthRatio)))
  const maxLines = Math.max(1, Math.floor((boxHIn * 72) / (finalSize * lineHeightRatio)))
  const lines = wrapTextByChars(text, charsPerLine)
  const clipped = lines.slice(0, Math.max(1, maxLines - 1))
  clipped.push("... continued")
  return { text: clipped.join("\n"), fontSize: finalSize }
}

/**
 * Adds the content slide with 2-row / 2-col layout.
 */
const addContentSlide = (
  pres: any,
  department: string,
  report: WeeklyReport,
  nextDept?: string,
  pageNumber?: number
) => {
  const slide = pres.addSlide()
  slide.background = { color: ACOB_OFFWHITE }

  // ── Header bar ───────────────────────────────────────────────────────────
  const headerH = 0.65
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: 0,
    y: 0,
    w: "100%",
    h: headerH,
    fill: { color: ACOB_DARK },
    line: { color: ACOB_DARK },
  })
  // Department name — left
  slide.addText(department.toUpperCase(), {
    x: 0.3,
    y: 0,
    w: 9,
    h: headerH,
    fontSize: 16,
    bold: true,
    color: ACOB_WHITE,
    valign: "middle",
    fontFace: "Calibri",
  })
  // Logo — right side of header: dark logo (acob-logo-dark.webp) on dark bg
  // headerH = 0.65" → logo h=0.48" (with 0.085" top/bottom margin), w=2.2"
  try {
    slide.addImage({
      path: LOGO_ICON,
      x: 11.45,
      y: 0.14,
      w: 1.7,
      h: 0.37,
    })
  } catch {
    /* skip */
  }

  // ── Layout constants ─────────────────────────────────────────────────────
  const marginX = 0.25
  const usableW = 13.33 - marginX * 2 // ≈ 12.83"
  const col1W = usableW * (3 / 5) // Work Done — 3/5
  const col2W = usableW * (2 / 5) - 0.15 // Tasks for New Week — 2/5 (minus gap)
  const col2X = marginX + col1W + 0.15

  const startY = headerH + 0.15
  const availH = 6.9 - startY - 0.15 // space above footer strip
  const row1H = availH * (4 / 6) // Row 1 — 4/6 of height
  const row2H = availH * (2 / 6) - 0.15 // Row 2 — 2/6 of height
  const row1Y = startY
  const row2Y = startY + row1H + 0.15
  const fullW = usableW

  // ── Row 1 left: Work Done ─────────────────────────────────────────────────
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: marginX,
    y: row1Y,
    w: col1W,
    h: row1H,
    fill: { color: ACOB_WHITE },
    line: { color: "E2E8F0", width: 1 },
  })
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: marginX + 0.15,
    y: row1Y + 0.1,
    w: col1W - 0.3,
    h: 0.3,
    fill: { color: ACOB_GREEN },
    line: { color: ACOB_GREEN, width: 0 },
  })
  slide.addText("WORK DONE", {
    x: marginX + 0.2,
    y: row1Y + 0.12,
    w: col1W - 0.4,
    h: 0.22,
    fontSize: 8,
    bold: true,
    color: ACOB_WHITE,
    fontFace: "Calibri",
  })
  const workDoneFitted = fitTextToPptxBox(
    autoNumberLines(report.work_done) || "No data provided.",
    col1W - 0.3,
    row1H - 0.56
  )
  slide.addText(workDoneFitted.text, {
    x: marginX + 0.15,
    y: row1Y + 0.46,
    w: col1W - 0.3,
    h: row1H - 0.56,
    fontSize: workDoneFitted.fontSize,
    color: ACOB_SLATE,
    valign: "top",
    fontFace: "Calibri",
    breakLine: true,
  })

  // ── Row 1 right: Tasks for New Week ──────────────────────────────────────
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: col2X,
    y: row1Y,
    w: col2W,
    h: row1H,
    fill: { color: ACOB_WHITE },
    line: { color: "E2E8F0", width: 1 },
  })
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: col2X + 0.15,
    y: row1Y + 0.1,
    w: col2W - 0.3,
    h: 0.3,
    fill: { color: "1D6A96" },
    line: { color: "1D6A96", width: 0 },
  })
  slide.addText("TASKS FOR NEW WEEK", {
    x: col2X + 0.2,
    y: row1Y + 0.12,
    w: col2W - 0.4,
    h: 0.22,
    fontSize: 8,
    bold: true,
    color: ACOB_WHITE,
    fontFace: "Calibri",
  })
  const tasksFitted = fitTextToPptxBox(
    autoNumberLines(report.tasks_new_week) || "No data provided.",
    col2W - 0.3,
    row1H - 0.56
  )
  slide.addText(tasksFitted.text, {
    x: col2X + 0.15,
    y: row1Y + 0.46,
    w: col2W - 0.3,
    h: row1H - 0.56,
    fontSize: tasksFitted.fontSize,
    color: ACOB_SLATE,
    valign: "top",
    fontFace: "Calibri",
    breakLine: true,
  })

  // ── Row 2: Challenges (full width) ────────────────────────────────────────
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: marginX,
    y: row2Y,
    w: fullW,
    h: row2H,
    fill: { color: ACOB_WHITE },
    line: { color: "E2E8F0", width: 1 },
  })
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: marginX + 0.15,
    y: row2Y + 0.1,
    w: fullW - 0.3,
    h: 0.3,
    fill: { color: "B91C1C" },
    line: { color: "B91C1C", width: 0 },
  })
  slide.addText("CHALLENGES", {
    x: marginX + 0.2,
    y: row2Y + 0.12,
    w: fullW - 0.4,
    h: 0.22,
    fontSize: 8,
    bold: true,
    color: ACOB_WHITE,
    fontFace: "Calibri",
  })
  const challengesFitted = fitTextToPptxBox(
    autoNumberLines(report.challenges) || "No challenges reported.",
    fullW - 0.3,
    row2H - 0.56
  )
  slide.addText(challengesFitted.text, {
    x: marginX + 0.15,
    y: row2Y + 0.46,
    w: fullW - 0.3,
    h: row2H - 0.56,
    fontSize: challengesFitted.fontSize,
    color: ACOB_SLATE,
    valign: "top",
    fontFace: "Calibri",
    breakLine: true,
  })

  // ── Bottom green strip ────────────────────────────────────────────────────
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: 0,
    y: 6.9,
    w: "100%",
    h: 0.6,
    fill: { color: ACOB_GREEN },
    line: { color: ACOB_GREEN },
  })

  if (nextDept) {
    slide.addText(`NEXT: ${nextDept}`, {
      x: 7,
      y: 6.9,
      w: 6.1,
      h: 0.6,
      fontSize: 10,
      color: ACOB_WHITE,
      align: "right",
      valign: "middle",
      fontFace: "Calibri",
      bold: true,
    })
  }

  if (typeof pageNumber === "number") {
    slide.addText(String(pageNumber), {
      x: 0,
      y: 6.9,
      w: "100%",
      h: 0.6,
      fontSize: 10,
      color: ACOB_WHITE,
      align: "center",
      valign: "middle",
      fontFace: "Calibri",
      bold: true,
    })
  }

  return slide
}

// ─── Public Export Functions ──────────────────────────────────────────────────

export const exportToPPTX = async (report: WeeklyReport) => {
  const PptxConstructor = await loadPptxGenJS()
  const pres = new PptxConstructor()
  pres.layout = "LAYOUT_WIDE"

  const p = Array.isArray(report.profiles) ? report.profiles[0] : report.profiles
  const name = p ? `${p.first_name} ${p.last_name}` : "Employee"

  // Slide 1 — Cover
  addCoverSlide(pres, report.week_number, report.year, report.department)

  // Slide 2 — Department title
  addDeptTitleSlide(pres, report.department, name)

  // Slide 3 — Content (no "NEXT" for single export)
  addContentSlide(pres, report.department, report, undefined, 3)

  await pres.writeFile({ fileName: `ACOB_Report_${report.department}_W${report.week_number}.pptx` })
}

export const exportAllToPPTX = async (reports: WeeklyReport[], week: number, year: number) => {
  const PptxConstructor = await loadPptxGenJS()
  const pres = new PptxConstructor()
  pres.layout = "LAYOUT_WIDE"

  const sortedReports = sortReportsByDepartment(reports)
  const departments = sortedReports.map((r) => r.department)

  // Slide 1 — Cover
  addCoverSlide(pres, week, year)

  // Slide 2 — Dept index
  addDeptIndexSlide(pres, departments, week, year, (index) => 3 + index * 2)

  sortedReports.forEach((report, idx) => {
    const p = Array.isArray(report.profiles) ? report.profiles[0] : report.profiles
    const name = p ? `${p.first_name} ${p.last_name}` : "Employee"
    // Department title slide
    addDeptTitleSlide(pres, report.department, name)

    // Content slide
    addContentSlide(pres, report.department, report, sortedReports[idx + 1]?.department, 4 + idx * 2)
  })

  await pres.writeFile({ fileName: `ACOB_Weekly_Reports_All_W${week}_${year}.pptx` })
}
