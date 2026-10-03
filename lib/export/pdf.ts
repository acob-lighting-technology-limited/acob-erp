/** Weekly report and action-point PDF exports (jsPDF). Split out of lib/export-utils.ts (audit 5.10). */
import { jsPDF } from "jspdf"
import { saveAs } from "file-saver"
import { Footer } from "docx"
import { getActionPointsDepartmentHeading } from "@/shared/departments"
import { getSeasonalLogoPaths } from "@/lib/seasonal-branding"

import {
  WeeklyReport,
  formatActionPointsDate,
  formatExportMeetingDateLabel,
  buildWeeklyReportFilename,
  buildActionPointFilename,
  DEPARTMENT_ORDER,
  sortReportsByDepartment,
  cleanPastedText,
  autoNumberLines,
  getWeekMonday,
  fetchImageAsBase64,
  ActionItem,
  groupActionItemsByDepartment,
} from "./shared"

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

  // Optional subtitle (dept name or "Action Points")
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
const _pdfDeptHeaderPage = (doc: jsPDF, department: string, _submittedBy: string) => {
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

  // Body: weighted rows — Work Done 50%, Tasks 30%, Challenges 20%
  const bodyStart = headerH + 4
  const footerStart = H - footerH
  const bodyH = footerStart - bodyStart
  const sectionWeights = [0.5, 0.3, 0.2] // Work Done, Tasks, Challenges
  const labelH = 8 // slightly taller label bar
  const padX = 14
  const innerW = W - padX * 2
  const fontSize = 10 // bigger body font
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
        const line = cleanPastedText(rawLine.trim())
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
        const bodyText = cleanPastedText(numbered[2] || "")
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

    // Last fallback: render as many lines as fit at the smallest font size.
    doc.setFontSize(7)
    const lines = buildLinesWithIndent(text, width, 5.0)
    const maxLines = Math.max(1, Math.floor(availableH / 3.9))
    let ty = y
    lines.slice(0, maxLines).forEach((line) => {
      doc.text(line.text, x + line.indent, ty)
      ty += 3.9
    })
  }

  let sectionTop = bodyStart
  sections.forEach((s, i) => {
    const rowH = bodyH * sectionWeights[i]

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

    sectionTop += rowH
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

export const exportToPDF = async (report: WeeklyReport, meetingDate?: string) => {
  const doc = new jsPDF()
  // Cover shows the CURRENT week (week being reported IN = report week + 1)
  const currentWeek = report.week_number + 1
  const currentYear = currentWeek > 52 ? report.year + 1 : report.year
  const meetingDateLabel = formatExportMeetingDateLabel(currentWeek, currentYear, meetingDate)

  const [logoFull, logoDark] = await Promise.all([
    fetchImageAsBase64(getSeasonalLogoPaths("light").full),
    fetchImageAsBase64(getSeasonalLogoPaths("light").icon),
  ])

  // Page 1 — Cover (shows current week / meeting date)
  pdfCoverPage(doc, currentWeek, currentYear, meetingDateLabel, logoFull, report.department)

  // Page 2 — Content (no separate dept header page)
  doc.addPage()
  pdfContentPage(doc, report.department, report, logoDark)

  doc.save(
    buildWeeklyReportFilename({
      week: report.week_number,
      year: report.year,
      meetingDate,
      extension: "pdf",
      department: report.department,
    })
  )
}

export const exportAllToPDF = async (reports: WeeklyReport[], week: number, year: number, meetingDate?: string) => {
  const doc = new jsPDF()
  const sortedReports = sortReportsByDepartment(reports)
  // Cover shows the CURRENT week (week being reported IN = report week + 1)
  const currentWeek = week + 1
  const currentYear = currentWeek > 52 ? year + 1 : year
  const meetingDateLabel = formatExportMeetingDateLabel(currentWeek, currentYear, meetingDate)
  const departments = sortedReports.map((r) => r.department)

  const [logoFull, logoDark] = await Promise.all([
    fetchImageAsBase64(getSeasonalLogoPaths("light").full),
    fetchImageAsBase64(getSeasonalLogoPaths("light").icon),
  ])

  // Page 1 — Cover (current week / meeting date)
  pdfCoverPage(doc, currentWeek, currentYear, meetingDateLabel, logoFull)

  // Page 2 — Dept index
  doc.addPage()
  pdfDeptIndexPage(doc, departments, week, year)

  sortedReports.forEach((report, idx) => {
    // Content page only — no separate green dept header page
    doc.addPage()
    pdfContentPage(doc, report.department, report, logoDark, idx + 3)
  })

  doc.save(
    buildWeeklyReportFilename({
      week,
      year,
      meetingDate,
      extension: "pdf",
      allDepartments: true,
    })
  )
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
    fetchImageAsBase64(getSeasonalLogoPaths("light").full),
    fetchImageAsBase64(getSeasonalLogoPaths("light").icon),
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

// ─── Action Point PDF ───────────────────────────────────────────────────────

const pdfActionPointPage = (
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
  doc.text("ACTION POINTS", 14, headerH + 18)
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
 * Generates the Action Point PDF and returns it as a base64 string (for email attachment).
 */
export const exportActionPointToPDFBase64 = async (
  actions: ActionItem[],
  week: number,
  year: number,
  meetingDate?: string
): Promise<string> => {
  const doc = new jsPDF()
  // Action Point week IS the current week (no +1 needed)
  const meetingDateLabel = formatExportMeetingDateLabel(week, year, meetingDate)

  const [logoFull, logoDark] = await Promise.all([
    fetchImageAsBase64(getSeasonalLogoPaths("light").full),
    fetchImageAsBase64(getSeasonalLogoPaths("light").icon),
  ])

  // Cover page — shows current week with "Action Points" subtitle
  pdfCoverPage(doc, week, year, meetingDateLabel, logoFull, "Action Points")

  // Group actions by department (in DEPARTMENT_ORDER)
  const { grouped, departments } = groupActionItemsByDepartment(actions)

  // Page 2 — Dept index / TOC
  doc.addPage()
  pdfDeptIndexPage(doc, departments, week, year)

  departments.forEach((dept, idx) => {
    const deptActions = grouped[dept] || []
    doc.addPage()
    pdfActionPointPage(doc, dept, deptActions, logoDark, week, year, idx + 3)
  })

  return doc.output("datauristring").split(",")[1]
}

/**
 * Saves the Action Point as a downloadable PDF file.
 */
export const exportActionPointToPDF = async (
  actions: ActionItem[],
  week: number,
  year: number,
  meetingDate?: string,
  department?: string
): Promise<void> => {
  const doc = new jsPDF()
  const pageWidth = 210
  const left = 18
  const contentWidth = 170
  const topMargin = 20
  const nextPageTop = 18
  const bottomLimit = 274
  const meetingDateLabel = formatActionPointsDate(week, year, meetingDate)
  const { grouped, departments } = groupActionItemsByDepartment(actions)

  let pageNumber = 1
  let y = topMargin

  const renderFooter = () => {
    doc.setFillColor(...PDF_GREEN)
    doc.rect(0, 283, pageWidth, 14, "F")
    doc.setFontSize(8)
    doc.setTextColor(...PDF_WHITE)
    doc.setFont("helvetica", "normal")
    doc.text("Confidential - ACOB Internal Use Only", 14, 292)
    doc.setFont("helvetica", "bold")
    doc.text(String(pageNumber), pageWidth / 2, 292, { align: "center" })
  }

  const startPage = (isFirstPage: boolean) => {
    if (!isFirstPage) {
      renderFooter()
      doc.addPage()
      pageNumber += 1
    }

    doc.setTextColor(...PDF_DARK)
    if (isFirstPage) {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(18)
      doc.text("ACTION POINTS", pageWidth / 2, 16, { align: "center" })
      doc.setFont("helvetica", "normal")
      doc.setFontSize(11)
      doc.setTextColor(...PDF_MUTED)
      doc.text(`Date: ${meetingDateLabel}`, left, 26)
      y = 34
      return
    }

    y = nextPageTop
  }

  startPage(true)

  departments.forEach((dept, deptIndex) => {
    const deptHeading = `${deptIndex + 1}. ${getActionPointsDepartmentHeading(dept)}`
    const deptActions = grouped[dept] || []

    if (y > bottomLimit - 12) startPage(false)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.setTextColor(...PDF_DARK)
    doc.text(deptHeading, left, y)
    y += 8

    deptActions.forEach((action) => {
      const lines = doc.splitTextToSize(action.title || "", contentWidth)
      const rowHeight = Math.max(6, lines.length * 5)

      if (y + rowHeight > bottomLimit) startPage(false)

      doc.setFillColor(...PDF_DARK)
      doc.circle(left + 3, y - 1.5, 0.8, "F")
      doc.setFont("helvetica", "normal")
      doc.setFontSize(11)
      doc.setTextColor(...PDF_SLATE)
      doc.text(lines, left + 10, y)
      y += rowHeight + 2
    })

    y += 4
  })

  renderFooter()

  saveAs(doc.output("blob"), buildActionPointFilename({ week, year, meetingDate, extension: "pdf", department }))
}

/**
 * Exports the Action Point as a PPTX presentation.
 */
