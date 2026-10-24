/** Weekly report and action-point PowerPoint exports (pptxgenjs, loaded on demand). Split out of lib/export-utils.ts (audit 5.10). */
import { shuffle } from "@/lib/utils/random"
import { Footer, Table } from "docx"
import { normalizeDepartmentName } from "@/shared/departments"

import type {
  WeeklyDeptTaskSummary,
  WeeklyTaskSummaryOptions,
  WeeklyTaskSummaryPlacement,
} from "@/lib/reports/weekly-task-summary"

import {
  PptxSlide,
  PptxTextRun,
  PptxPresentation,
  PptxConstructor,
  loadPptxGenJS,
  WeeklyReport,
  inFlightActionPointFileExports,
  formatExportMeetingDateLabel,
  buildWeeklyReportFilename,
  buildActionPointFilename,
  sortReportsByDepartment,
  autoNumberLines,
  ActionItem,
  groupActionItemsByDepartment,
  ACOB_GREEN,
  ACOB_GREEN_LIGHT,
  ACOB_GREEN_DEEP,
  ACOB_DARK,
  ACOB_SLATE,
  ACOB_MUTED,
  ACOB_WHITE,
  ACOB_OFFWHITE,
  SECTION_TASKS,
  SECTION_CHALLENGES,
  EXPORT_LOGOS,
  logoBoxByHeight,
  logoBoxByWidth,
  WeeklyPptxTheme,
  WeeklyDeptOrder,
} from "./shared"

export const exportActionPointToPPTX = async (
  actions: ActionItem[],
  week: number,
  year: number,
  meetingDate?: string,
  department?: string
): Promise<void> => {
  const exportKey = ["pptx", week, year, meetingDate || "", department || "all", actions.length].join(":")
  if (inFlightActionPointFileExports.has(exportKey)) return
  inFlightActionPointFileExports.add(exportKey)

  try {
    const PptxConstructor = await loadPptxGenJS()
    const pres = new PptxConstructor()
    pres.layout = "LAYOUT_WIDE"

    // Cover slide
    addCoverSlide(pres, week, year, "Action Points")

    // Group by department
    const { grouped, departments } = groupActionItemsByDepartment(actions)

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
        const markBox = logoBoxByHeight(EXPORT_LOGOS.matrixMarkInverse, 0.4)
        slide.addImage({
          path: EXPORT_LOGOS.matrixMarkInverse.path,
          x: 13.33 - 0.3 - markBox.w,
          y: (0.65 - markBox.h) / 2,
          ...markBox,
        })
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

    await pres.writeFile({
      fileName: buildActionPointFilename({ week, year, meetingDate, extension: "pptx", department }),
    })
  } finally {
    inFlightActionPointFileExports.delete(exportKey)
  }
}

// ─── DOCX helpers ─────────────────────────────────────────────────────────────

/** Returns a heading paragraph with coloured text + underline (no shaded background). */

const getWeeklyPptxThemeColors = (theme: WeeklyPptxTheme = "light") => {
  if (theme === "dark") {
    return {
      canvas: "111111",
      header: ACOB_GREEN_DEEP,
      headerMuted: ACOB_GREEN_LIGHT,
      ghostOnAccent: "14603A",
      accent: ACOB_GREEN,
      footer: ACOB_GREEN_DEEP,
      textPrimary: "F5F5F5",
      textMuted: "A3A3A3",
      textInverse: ACOB_WHITE,
      card: "1C1C1C",
      cardBorder: "2C2C2C",
      separator: "3A3A3A",
      sectionText: "E5E7EB",
      titleFill: ACOB_GREEN,
      ghost: "1B2A22",
    }
  }

  return {
    canvas: ACOB_OFFWHITE,
    header: ACOB_GREEN_DEEP,
    headerMuted: ACOB_GREEN_LIGHT,
    ghostOnAccent: "14603A",
    accent: ACOB_GREEN,
    footer: ACOB_GREEN_DEEP,
    textPrimary: ACOB_DARK,
    textMuted: ACOB_MUTED,
    textInverse: ACOB_WHITE,
    card: ACOB_WHITE,
    cardBorder: "E2E8F0",
    separator: "E2E8F0",
    sectionText: ACOB_SLATE,
    titleFill: ACOB_GREEN,
    ghost: ACOB_GREEN_LIGHT,
  }
}

/**
 * Adds the ACOB cover slide.
 *
 * Editorial left-aligned layout: a green rail runs down the left edge and turns
 * along the bottom into the footer, the ACOB wordmark sits above a left-anchored
 * title stack, and the week number is set oversized and ghosted behind the right
 * half of the slide as a graphic element.
 */
const addCoverSlide = (
  pres: PptxPresentation,
  week: number,
  year: number,
  subtitle?: string,
  theme: WeeklyPptxTheme = "light",
  meetingDate?: string
) => {
  const colors = getWeeklyPptxThemeColors(theme)
  const isDark = theme === "dark"
  const slide = pres.addSlide()

  slide.background = { color: isDark ? colors.canvas : ACOB_WHITE }

  const railW = 0.3
  const contentX = 1.05

  // ── Ghosted week numeral (drawn first so everything else sits on top) ──────
  slide.addText(String(week), {
    x: 6.9,
    y: 0.55,
    w: 5.9,
    h: 4.4,
    fontSize: 200,
    bold: true,
    color: colors.ghost,
    align: "right",
    valign: "middle",
    fontFace: "Calibri",
  })

  // ── Green rail: left edge, continuing into the bottom footer strip ────────
  // Matches the footer so the two read as one continuous L, not two greens.
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: 0,
    y: 0,
    w: railW,
    h: 7.5,
    fill: { color: colors.footer },
    line: { color: colors.footer },
  })

  // ── Matrix mark, top right ────────────────────────────────────────────────
  const markLogo = isDark ? EXPORT_LOGOS.matrixMarkInverse : EXPORT_LOGOS.matrixMark
  const markBox = logoBoxByHeight(markLogo, 0.6)
  try {
    slide.addImage({
      path: markLogo.path,
      x: 13.33 - 0.6 - markBox.w,
      y: 0.55,
      ...markBox,
    })
  } catch {
    /* skip */
  }

  // ── ACOB LIGHTING wordmark ────────────────────────────────────────────────
  const wordmark = isDark ? EXPORT_LOGOS.acobInverse : EXPORT_LOGOS.acobFull
  const wordmarkBox = logoBoxByWidth(wordmark, 4.3)
  try {
    slide.addImage({
      path: wordmark.path,
      x: contentX,
      y: 1.0,
      ...wordmarkBox,
    })
  } catch {
    slide.addText("ACOB LIGHTING TECHNOLOGY LIMITED", {
      x: contentX,
      y: 1.0,
      w: 8,
      h: wordmarkBox.h,
      fontSize: 22,
      bold: true,
      color: colors.textPrimary,
      valign: "middle",
      fontFace: "Calibri",
    })
  }

  // ── Title stack ───────────────────────────────────────────────────────────
  slide.addText("GENERAL MEETING", {
    x: contentX,
    y: 2.55,
    w: 8,
    h: 0.36,
    fontSize: 15,
    bold: true,
    color: colors.accent,
    charSpacing: 4,
    valign: "middle",
    fontFace: "Calibri",
  })

  // Optical alignment: large Calibri carries a little left side bearing, so the
  // hero is nudged left to line its glyph edge up with the eyebrow above it.
  slide.addText("Weekly Report", {
    x: contentX - 0.09,
    y: 2.95,
    w: 9,
    h: 1.2,
    fontSize: 60,
    bold: true,
    color: colors.textPrimary,
    valign: "middle",
    fontFace: "Calibri",
  })

  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: contentX,
    y: 4.28,
    w: 2.6,
    h: 0.05,
    fill: { color: colors.accent },
    line: { color: colors.accent },
  })

  slide.addText(formatExportMeetingDateLabel(week, year, meetingDate), {
    x: contentX,
    y: 4.55,
    w: 8,
    h: 0.44,
    fontSize: 18,
    color: colors.textMuted,
    valign: "middle",
    fontFace: "Calibri",
  })

  // ── "WEEK N" pill ─────────────────────────────────────────────────────────
  const pillW = 1.85
  const pillY = 5.2
  const pillH = 0.44
  slide.addShape(pres.ShapeType?.roundRect ?? "roundRect", {
    x: contentX,
    y: pillY,
    w: pillW,
    h: pillH,
    rectRadius: 0.22,
    fill: { color: colors.accent },
    line: { color: colors.accent },
  })
  slide.addText(`WEEK ${week}`, {
    x: contentX,
    y: pillY,
    w: pillW,
    h: pillH,
    fontSize: 14,
    bold: true,
    color: colors.textInverse,
    charSpacing: 1,
    align: "center",
    valign: "middle",
    fontFace: "Calibri",
  })

  // Optional subtitle (dept name for single-report export)
  if (subtitle) {
    slide.addText(subtitle, {
      x: contentX + pillW + 0.22,
      y: pillY,
      w: 6,
      h: pillH,
      fontSize: 15,
      color: colors.accent,
      italic: true,
      valign: "middle",
      fontFace: "Calibri",
    })
  }

  // ── Bottom green strip ────────────────────────────────────────────────────
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: 0,
    y: 6.9,
    w: "100%",
    h: 0.6,
    fill: { color: colors.footer },
    line: { color: colors.footer },
  })
  slide.addText("Confidential — ACOB Internal Use Only", {
    x: 0,
    y: 6.9,
    w: "100%",
    h: 0.6,
    fontSize: 10,
    color: colors.textInverse,
    align: "center",
    valign: "middle",
    fontFace: "Calibri",
  })

  return slide
}

/**
 * Adds a department title slide (full-bleed green).
 */
const addDeptTitleSlide = (
  pres: PptxPresentation,
  department: string,
  _submittedBy: string,
  pageNumber?: number,
  theme: WeeklyPptxTheme = "light",
  position?: { index: number; total: number }
) => {
  const colors = getWeeklyPptxThemeColors(theme)
  const slide = pres.addSlide()
  slide.background = { color: colors.titleFill }

  const contentX = 1.05
  const pad = (n: number) => String(n).padStart(2, "0")

  // ── Ghosted running-order numeral, mirroring the cover's week number ───────
  if (position) {
    slide.addText(pad(position.index), {
      x: 6.9,
      y: 1.58,
      w: 5.6,
      h: 4.2,
      fontSize: 190,
      bold: true,
      color: colors.ghostOnAccent,
      align: "right",
      valign: "middle",
      fontFace: "Calibri",
    })
  }

  // ── Eyebrow ───────────────────────────────────────────────────────────────
  slide.addText(position ? `DEPARTMENT ${pad(position.index)} OF ${pad(position.total)}` : "DEPARTMENT", {
    x: contentX,
    y: 2.75,
    w: 8,
    h: 0.36,
    fontSize: 14,
    bold: true,
    color: colors.headerMuted,
    charSpacing: 4,
    valign: "middle",
    fontFace: "Calibri",
  })

  slide.addText(department.toUpperCase(), {
    x: contentX - 0.08,
    y: 3.17,
    w: 11,
    h: 1.25,
    fontSize: 54,
    bold: true,
    color: colors.textInverse,
    valign: "middle",
    fontFace: "Calibri",
  })

  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: contentX,
    y: 4.57,
    w: 2.6,
    h: 0.05,
    fill: { color: colors.textInverse },
    line: { color: colors.textInverse },
  })

  // ── Footer band: wordmark and page number ─────────────────────────────────
  const wordmarkBox = logoBoxByHeight(EXPORT_LOGOS.acobInverse, 0.34)
  try {
    slide.addImage({
      path: EXPORT_LOGOS.acobInverse.path,
      x: 0.55,
      y: 6.98,
      ...wordmarkBox,
    })
  } catch {
    /* skip */
  }

  if (typeof pageNumber === "number") {
    slide.addText(String(pageNumber), {
      x: 0,
      y: 6.9,
      w: "100%",
      h: 0.5,
      fontSize: 10,
      bold: true,
      color: colors.textInverse,
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
  pres: PptxPresentation,
  departments: string[],
  week: number,
  year: number,
  pageNumberForDepartment: (index: number) => number = (index) => index + 3,
  theme: WeeklyPptxTheme = "light"
) => {
  const colors = getWeeklyPptxThemeColors(theme)
  const slide = pres.addSlide()
  slide.background = { color: colors.canvas }

  // Header
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: 0,
    y: 0,
    w: "100%",
    h: 0.65,
    fill: { color: colors.header },
    line: { color: colors.header },
  })
  slide.addText("Departments in This Report", {
    x: 0.3,
    y: 0,
    w: 10,
    h: 0.65,
    fontSize: 16,
    bold: true,
    color: colors.textInverse,
    valign: "middle",
    fontFace: "Calibri",
  })
  slide.addText(`Week ${week}, ${year}`, {
    x: 10,
    y: 0,
    w: 3,
    h: 0.65,
    fontSize: 12,
    color: theme === "dark" ? colors.textMuted : ACOB_GREEN_LIGHT,
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
      fill: { color: colors.accent },
      line: { color: colors.accent },
    })
    slide.addText(`${i + 1}`, {
      x: 0.5,
      y: y + 0.05,
      w: 0.38,
      h: 0.38,
      fontSize: 11,
      bold: true,
      color: colors.textInverse,
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
      color: colors.textPrimary,
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
      color: colors.accent,
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
        line: { color: colors.separator, width: 0.5 },
      })
    }
  })

  // Bottom strip
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: 0,
    y: 6.9,
    w: "100%",
    h: 0.6,
    fill: { color: colors.footer },
    line: { color: colors.footer },
  })
  return slide
}

const PPTX_WEEKLY_BODY_FONT_SIZE = 14
// Floor for shrink-to-fit. Anything under ~10pt is unreadable when projected,
// so an over-long report should visibly overflow (and get trimmed) rather than
// silently render at a size nobody in the room can read.
const PPTX_WEEKLY_MIN_BODY_FONT_SIZE = 10
const PPTX_WEEKLY_SECTION_TITLE_SIZE = 12
const PPTX_WEEKLY_LINE_HEIGHT_RATIO = 1.15
const PPTX_WEEKLY_AVG_CHAR_WIDTH_RATIO = 0.48
const PPTX_WEEKLY_LINE_SPACING_MULTIPLE = 1.3

// Content slides keep their chrome slim: the header, footer and side margins
// were trimmed so the report text gets the room (~0.5in more height, ~0.25in
// more width). Cover, department title and index slides keep their own layout.
const WEEKLY_CONTENT_LAYOUT = {
  headerH: 0.5,
  marginX: 0.12,
  slideW: 13.33,
  footerY: 7.08,
  footerH: 0.42,
}

const applyWeeklySlideTransition = (slide: PptxSlide) => {
  // PptxGenJS transition support varies by viewer/version; keep this guarded.
  try {
    slide.transition = {
      type: "fade",
      duration: 0.4,
    }
  } catch {
    /* no-op */
  }
}

const getWeeklyContentBoxes = () => {
  const { headerH, marginX, slideW, footerY } = WEEKLY_CONTENT_LAYOUT
  const bodyBottomSafety = 0.08
  // Card chrome above the body text: title row + hairline + gap (see addSectionCard).
  const CARD_HEADER_H = 0.72
  const textBottomSafety = 0.1
  const usableW = slideW - marginX * 2
  const col1W = usableW * (3 / 5)
  const col2W = usableW * (2 / 5) - 0.15
  const col2X = marginX + col1W + 0.15

  const startY = headerH + 0.08
  const availH = footerY - startY - bodyBottomSafety
  const row1H = availH * (4 / 6)
  const row2H = availH * (2 / 6) - 0.15
  const row1Y = startY
  const row2Y = startY + row1H + 0.15
  const page2Gap = 0.08
  const page2TopH = (availH - page2Gap) * 0.75
  const page2BottomH = (availH - page2Gap) * 0.25
  const splitTopH = (availH - page2Gap) * 0.55
  const splitBottomH = (availH - page2Gap) * 0.45
  const splitBottomY = startY + splitTopH + page2Gap
  const splitColGap = 0.15
  const splitChallengesW = (usableW - splitColGap) * 0.6
  const splitSummaryW = usableW - splitColGap - splitChallengesW

  return {
    row1Left: {
      x: marginX,
      y: row1Y,
      w: col1W,
      h: row1H,
      textW: col1W - 0.3,
      textH: Math.max(0.6, row1H - CARD_HEADER_H - textBottomSafety),
    },
    row1Right: {
      x: col2X,
      y: row1Y,
      w: col2W,
      h: row1H,
      textW: col2W - 0.3,
      textH: Math.max(0.6, row1H - CARD_HEADER_H - textBottomSafety),
    },
    row2Full: {
      x: marginX,
      y: row2Y,
      w: usableW,
      h: row2H,
      textW: usableW - 0.3,
      textH: Math.max(0.6, row2H - CARD_HEADER_H - textBottomSafety),
    },
    continuation: {
      x: marginX,
      y: startY,
      w: usableW,
      h: availH,
      textW: usableW - 0.3,
      textH: Math.max(0.6, availH - CARD_HEADER_H - textBottomSafety),
    },
    page2Top: {
      x: marginX,
      y: startY,
      w: usableW,
      h: page2TopH,
      textW: usableW - 0.3,
      textH: Math.max(0.6, page2TopH - CARD_HEADER_H - textBottomSafety),
    },
    page2Bottom: {
      x: marginX,
      y: startY + page2TopH + page2Gap,
      w: usableW,
      h: page2BottomH,
      textW: usableW - 0.3,
      textH: Math.max(0.6, page2BottomH - CARD_HEADER_H - textBottomSafety),
    },
    // "Beside Challenges" task summary: Tasks for New Week gives up height so the
    // bottom row is tall enough to split into Challenges | Task summary.
    splitTop: {
      x: marginX,
      y: startY,
      w: usableW,
      h: splitTopH,
      textW: usableW - 0.3,
      textH: Math.max(0.6, splitTopH - CARD_HEADER_H - textBottomSafety),
    },
    splitChallenges: {
      x: marginX,
      y: splitBottomY,
      w: splitChallengesW,
      h: splitBottomH,
      textW: splitChallengesW - 0.3,
      textH: Math.max(0.6, splitBottomH - CARD_HEADER_H - textBottomSafety),
    },
    splitSummary: {
      x: marginX + splitChallengesW + splitColGap,
      y: splitBottomY,
      w: splitSummaryW,
      h: splitBottomH,
      textW: splitSummaryW - 0.3,
      textH: Math.max(0.6, splitBottomH - CARD_HEADER_H - textBottomSafety),
    },
  }
}

type WeeklySectionPlan = {
  key: "work_done" | "tasks_new_week" | "challenges"
  title: string
  color: string
  text: string
  fontSize: number
  allowAutoShrink: boolean
}

export type WeeklyPptxMode = "compact" | "full"

const withListItemSpacing = (text: string): string => {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0)
  if (lines.length === 0) return ""
  return lines.join("\n")
}

const countWrappedLines = (text: string, maxCharsPerLine: number): number => {
  const sourceLines = String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
  let total = 0

  const wrapPlainLineCount = (line: string, limit: number): number => {
    if (!line) return 1
    if (line.length <= limit) return 1
    const words = line.split(/\s+/)
    let lines = 0
    let current = ""
    words.forEach((w) => {
      const candidate = current ? `${current} ${w}` : w
      if (candidate.length <= limit) {
        current = candidate
      } else {
        if (current) lines += 1
        if (w.length > limit) {
          lines += Math.ceil(w.length / limit)
          current = ""
        } else {
          current = w
        }
      }
    })
    if (current) lines += 1
    return Math.max(1, lines)
  }

  sourceLines.forEach((raw) => {
    const line = raw.trimEnd()
    if (!line) {
      total += 1
      return
    }
    const numberedMatch = line.match(/^(\d+\.)\s+(.*)$/)
    if (!numberedMatch) {
      total += wrapPlainLineCount(line, maxCharsPerLine)
      return
    }
    const prefix = `${numberedMatch[1]} `
    const body = numberedMatch[2] || ""
    const bodyLimit = Math.max(10, maxCharsPerLine - prefix.length)
    total += wrapPlainLineCount(body, bodyLimit)
  })

  return total
}

const chooseSectionFontSize = (
  text: string,
  boxWIn: number,
  boxHIn: number,
  preferredFont = PPTX_WEEKLY_BODY_FONT_SIZE,
  minFont = PPTX_WEEKLY_MIN_BODY_FONT_SIZE,
  _strictFit = true
): number => {
  for (let fontSize = preferredFont; fontSize >= minFont; fontSize -= 0.5) {
    const charsPerLine = Math.max(10, Math.floor((boxWIn * 72) / (fontSize * PPTX_WEEKLY_AVG_CHAR_WIDTH_RATIO)))
    const effectiveLineHeight = fontSize * PPTX_WEEKLY_LINE_HEIGHT_RATIO * PPTX_WEEKLY_LINE_SPACING_MULTIPLE
    const maxLines = Math.max(1, Math.floor((boxHIn * 72) / effectiveLineHeight))
    if (countWrappedLines(text, charsPerLine) <= maxLines) return fontSize
  }
  return minFont
}

const buildWeeklySectionPlan = (
  key: WeeklySectionPlan["key"],
  title: string,
  color: string,
  rawText: string,
  fallbackText: string,
  boxWIn: number,
  boxHIn: number,
  minFont = PPTX_WEEKLY_MIN_BODY_FONT_SIZE,
  strictFit = true,
  allowAutoShrink = true
): WeeklySectionPlan => {
  const normalized = autoNumberLines(rawText) || fallbackText
  const text = withListItemSpacing(normalized)
  return {
    key,
    title,
    color,
    text,
    fontSize: chooseSectionFontSize(text, boxWIn, boxHIn, PPTX_WEEKLY_BODY_FONT_SIZE, minFont, strictFit),
    allowAutoShrink,
  }
}

/** One department's task counts and where they sit in full mode. */
type WeeklyTaskSummarySlot = {
  placement: Exclude<WeeklyTaskSummaryPlacement, "none">
  summary: WeeklyDeptTaskSummary
}

type WeeklyDepartmentLayout = {
  workDone: WeeklyContentBox
  tasks: WeeklyContentBox
  challenges: WeeklyContentBox
  /** "On Work Done": slim per-person strip under the Work Done card. */
  strip?: WeeklyContentBox
  /** "Beside Work Done" / "Beside Challenges": per-person card beside that section. */
  summary?: WeeklyContentBox
}

const PPTX_TASK_STRIP_FONT_SIZE = 12
const PPTX_TASK_STRIP_GAP = 0.1
const PPTX_TASK_STRIP_MAX_LINES = 4
const PPTX_TASK_STRIP_LABEL = "BY STAFF   "
const PPTX_TASK_STRIP_SEPARATOR = "   ·   "
const PPTX_TASK_COUNT_COL_W = 0.6
const PPTX_TASK_SIDE_COLUMN_W = 2
// The side column is a reference panel, not the thing being read out, so it
// stays smaller than the Work Done text beside it.
const PPTX_TASK_SIDE_MAX_FONT = 12
const PPTX_TASK_SIDE_TITLE_SIZE = 10
const PPTX_TASK_SIDE_COLUMN_GAP = 0.12

const formatTaskRatio = (counts: { completed: number; assigned: number }) => `${counts.completed} / ${counts.assigned}`

const weeklyLineHeightIn = (fontSize: number) =>
  (fontSize * PPTX_WEEKLY_LINE_HEIGHT_RATIO * PPTX_WEEKLY_LINE_SPACING_MULTIPLE) / 72

const charsPerLineAt = (widthIn: number, fontSize: number) =>
  Math.max(4, Math.floor((widthIn * 72) / (fontSize * PPTX_WEEKLY_AVG_CHAR_WIDTH_RATIO)))

/** Estimated wrapped lines for the strip, treating each "Name 3 / 4" entry as unbreakable. */
const countTaskStripLines = (summary: WeeklyDeptTaskSummary, textW: number): number => {
  const limit = charsPerLineAt(textW, PPTX_TASK_STRIP_FONT_SIZE)
  let lines = 1
  let used = PPTX_TASK_STRIP_LABEL.length
  summary.people.forEach((person, index) => {
    const entry = `${person.name} ${formatTaskRatio(person)}`.length
    const withSeparator = entry + (index > 0 ? PPTX_TASK_STRIP_SEPARATOR.length : 0)
    if (used + withSeparator > limit) {
      lines += 1
      used = entry
    } else {
      used += withSeparator
    }
  })
  return Math.min(PPTX_TASK_STRIP_MAX_LINES, lines)
}

/**
 * "Kleopatra Aiyede" -> "Kleopatra A.", so names fit the narrow summary
 * column. Falls back to the full name where two people in the department
 * would otherwise read the same.
 */
const withShortNames = (summary: WeeklyDeptTaskSummary): WeeklyDeptTaskSummary => {
  const shorten = (name: string) => {
    const parts = name.trim().split(/\s+/)
    return parts.length < 2 ? name : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`
  }
  const uses = new Map<string, number>()
  summary.people.forEach((p) => uses.set(shorten(p.name), (uses.get(shorten(p.name)) ?? 0) + 1))
  return {
    ...summary,
    people: summary.people.map((p) => ({ ...p, name: uses.get(shorten(p.name)) === 1 ? shorten(p.name) : p.name })),
  }
}

const resolveTaskSummarySlot = (
  report: WeeklyReport,
  options?: WeeklyTaskSummaryOptions
): WeeklyTaskSummarySlot | undefined => {
  if (!options || options.placement === "none") return undefined
  const department = normalizeDepartmentName(report.department)
  const summary = options.summaries.get(department) ?? { department, completed: 0, assigned: 0, people: [] }
  return { placement: options.placement, summary: withShortNames(summary) }
}

const getWeeklyDepartmentLayout = (slot?: WeeklyTaskSummarySlot): WeeklyDepartmentLayout => {
  const boxes = getWeeklyContentBoxes()

  if (slot?.placement === "work_done") {
    const card = boxes.continuation
    const stripTextW = card.w - 0.5
    const stripH = 0.2 + countTaskStripLines(slot.summary, stripTextW) * weeklyLineHeightIn(PPTX_TASK_STRIP_FONT_SIZE)
    const taken = stripH + PPTX_TASK_STRIP_GAP
    return {
      workDone: { ...card, h: card.h - taken, textH: Math.max(0.6, card.textH - taken) },
      tasks: boxes.page2Top,
      challenges: boxes.page2Bottom,
      strip: { x: card.x, y: card.y + card.h - stripH, w: card.w, h: stripH, textW: stripTextW, textH: stripH - 0.1 },
    }
  }

  if (slot?.placement === "work_done_column") {
    const card = boxes.continuation
    const mainW = card.w - PPTX_TASK_SIDE_COLUMN_W - PPTX_TASK_SIDE_COLUMN_GAP
    return {
      workDone: { ...card, w: mainW, textW: mainW - 0.3 },
      tasks: boxes.page2Top,
      challenges: boxes.page2Bottom,
      summary: {
        ...card,
        x: card.x + mainW + PPTX_TASK_SIDE_COLUMN_GAP,
        w: PPTX_TASK_SIDE_COLUMN_W,
        textW: PPTX_TASK_SIDE_COLUMN_W - 0.3,
      },
    }
  }

  if (slot?.placement === "challenges") {
    return {
      workDone: boxes.continuation,
      tasks: boxes.splitTop,
      challenges: boxes.splitChallenges,
      summary: boxes.splitSummary,
    }
  }

  return { workDone: boxes.continuation, tasks: boxes.page2Top, challenges: boxes.page2Bottom }
}

const getZeroTasksColor = (theme: WeeklyPptxTheme) => (theme === "dark" ? "F87171" : "B91C1C")

const getTaskRatioColor = (counts: { completed: number; assigned: number }, theme: WeeklyPptxTheme) => {
  if (counts.assigned > 0 && counts.completed === 0) return getZeroTasksColor(theme)
  return getWeeklyPptxThemeColors(theme).accent
}

const truncateToChars = (text: string, maxChars: number) =>
  text.length <= maxChars ? text : `${text.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`

const getReportSectionPlans = (
  report: WeeklyReport,
  layout: WeeklyDepartmentLayout = getWeeklyDepartmentLayout()
): WeeklySectionPlan[] => {
  return [
    buildWeeklySectionPlan(
      "work_done",
      "WORK DONE",
      ACOB_GREEN,
      report.work_done,
      "No data provided.",
      layout.workDone.textW,
      layout.workDone.textH
    ),
    buildWeeklySectionPlan(
      "tasks_new_week",
      "TASKS FOR NEW WEEK",
      SECTION_TASKS,
      report.tasks_new_week,
      "No data provided.",
      layout.tasks.textW,
      layout.tasks.textH
    ),
    buildWeeklySectionPlan(
      "challenges",
      "CHALLENGES",
      SECTION_CHALLENGES,
      report.challenges,
      "No challenges reported.",
      layout.challenges.textW,
      layout.challenges.textH
    ),
  ]
}

const addWeeklyHeaderAndFooter = (
  pres: PptxPresentation,
  slide: PptxSlide,
  department: string,
  nextDept?: string,
  pageNumber?: number,
  theme: WeeklyPptxTheme = "light",
  slidePosition?: { index: number; total: number }
) => {
  const colors = getWeeklyPptxThemeColors(theme)
  const { headerH, footerY, footerH } = WEEKLY_CONTENT_LAYOUT

  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: 0,
    y: 0,
    w: "100%",
    h: headerH,
    fill: { color: colors.header },
    line: { color: colors.header },
  })

  // Department name, followed inline by its position within this department's
  // run of slides ("1 OF 2"). The footer is reserved for the *next* department,
  // so the two never have to share one label.
  const headerRuns: Array<{ text: string; options: Record<string, unknown> }> = [
    {
      text: department.toUpperCase(),
      options: { fontSize: 16, bold: true, color: colors.textInverse, fontFace: "Calibri" },
    },
  ]
  if (slidePosition && slidePosition.total > 1) {
    headerRuns.push({
      text: `    ${slidePosition.index} OF ${slidePosition.total}`,
      options: { fontSize: 11, bold: true, color: colors.headerMuted, fontFace: "Calibri" },
    })
  }

  slide.addText(headerRuns, {
    x: 0.3,
    y: 0,
    w: 9,
    h: headerH,
    valign: "middle",
    fontFace: "Calibri",
  })

  // Matrix mark, top right. The header bar is dark in both themes, so this is
  // always the inverse (flat white) variant.
  const markBox = logoBoxByHeight(EXPORT_LOGOS.matrixMarkInverse, 0.36)
  try {
    slide.addImage({
      path: EXPORT_LOGOS.matrixMarkInverse.path,
      x: 13.33 - 0.3 - markBox.w,
      y: (headerH - markBox.h) / 2,
      ...markBox,
    })
  } catch {
    /* skip */
  }

  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: 0,
    y: footerY,
    w: "100%",
    h: footerH,
    fill: { color: colors.footer },
    line: { color: colors.footer },
  })

  // ACOB LIGHTING wordmark, bottom left. The footer strip is green in both
  // themes, so this is always the inverse (white text) variant.
  const wordmarkBox = logoBoxByHeight(EXPORT_LOGOS.acobInverse, 0.28)
  try {
    slide.addImage({
      path: EXPORT_LOGOS.acobInverse.path,
      x: 0.3,
      y: footerY + (footerH - wordmarkBox.h) / 2,
      ...wordmarkBox,
    })
  } catch {
    /* skip */
  }

  if (nextDept) {
    slide.addText(`NEXT: ${nextDept.toUpperCase()}`, {
      x: 7,
      y: footerY,
      w: 6.1,
      h: footerH,
      fontSize: 10,
      color: colors.textInverse,
      align: "right",
      valign: "middle",
      fontFace: "Calibri",
      bold: true,
    })
  }

  if (typeof pageNumber === "number") {
    slide.addText(String(pageNumber), {
      x: 0,
      y: footerY,
      w: "100%",
      h: footerH,
      fontSize: 10,
      color: colors.textInverse,
      align: "center",
      valign: "middle",
      fontFace: "Calibri",
      bold: true,
    })
  }
}

type WeeklyContentBox = { x: number; y: number; w: number; h: number; textW: number; textH: number }

/** Inline count after a card title, e.g. "WORK DONE   14 / 20 TASKS COMPLETED". */
type WeeklyTitleSuffix = {
  text: string
  color: string
  /** Narrow cards: no letter-spacing on the title row, so label and total fit side by side. */
  compact?: boolean
}

const addSectionCardChrome = (
  pres: PptxPresentation,
  slide: PptxSlide,
  box: WeeklyContentBox,
  title: string,
  color: string,
  theme: WeeklyPptxTheme = "light",
  titleSuffix?: WeeklyTitleSuffix,
  titleSize = PPTX_WEEKLY_SECTION_TITLE_SIZE
) => {
  const colors = getWeeklyPptxThemeColors(theme)
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    fill: { color: colors.card },
    line: { color: colors.cardBorder, width: 1 },
  })

  // Colour spine down the card's left edge, echoing the rail on the cover and
  // department slides. Replaces the old filled title bar, which forced the
  // section label down to 8pt — half the size of the body text under it.
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: box.x,
    y: box.y,
    w: 0.07,
    h: box.h,
    fill: { color },
    line: { color, width: 0 },
  })

  const titleRuns: PptxTextRun[] = [{ text: title, options: { color } }]
  if (titleSuffix) {
    titleRuns.push({
      // Non-breaking spaces so a tight row never splits "19 / 36" across lines.
      text: `${titleSuffix.compact ? "  " : "   "}${titleSuffix.text}`.replace(/ /g, "\u00A0"),
      options: { color: titleSuffix.color },
    })
  }
  slide.addText(titleRuns, {
    x: box.x + 0.26,
    y: box.y + 0.11,
    w: box.w - 0.46,
    h: 0.3,
    fontSize: titleSize,
    bold: true,
    charSpacing: titleSuffix?.compact ? 0 : 2,
    valign: "middle",
    fontFace: "Calibri",
  })

  // Hairline under the title, separating label from content.
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: box.x + 0.26,
    y: box.y + 0.46,
    w: box.w - 0.5,
    h: 0.012,
    fill: { color: colors.separator },
    line: { color: colors.separator, width: 0 },
  })
}

const addSectionCard = (
  pres: PptxPresentation,
  slide: PptxSlide,
  box: WeeklyContentBox,
  title: string,
  color: string,
  text: string,
  fontSize: number,
  allowAutoShrink = true,
  useManualHangingWrap = false,
  theme: WeeklyPptxTheme = "light",
  titleSuffix?: WeeklyTitleSuffix
) => {
  const colors = getWeeklyPptxThemeColors(theme)
  addSectionCardChrome(pres, slide, box, title, color, theme, titleSuffix)

  const wrappedText =
    useManualHangingWrap && fontSize > 0
      ? wrapTextByCharsCompact(
          text,
          Math.max(10, Math.floor(((box.textW * 72) / (fontSize * PPTX_WEEKLY_AVG_CHAR_WIDTH_RATIO)) * 1.12))
        ).join("\n")
      : text

  slide.addText(wrappedText, {
    x: box.x + 0.26,
    y: box.y + 0.62,
    w: box.textW,
    h: box.textH,
    fontSize,
    color: colors.sectionText,
    valign: "top",
    fontFace: "Calibri",
    breakLine: !useManualHangingWrap,
    lineSpacingMultiple: PPTX_WEEKLY_LINE_SPACING_MULTIPLE,
    fit: allowAutoShrink ? "shrink" : undefined,
  })
}

const wrapTextByCharsCompact = (text: string, maxCharsPerLine: number): string[] => {
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

const fitTextToPptxBoxCompact = (
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
    const lines = wrapTextByCharsCompact(text, charsPerLine)
    if (lines.length <= maxLines) {
      return { text: lines.join("\n"), fontSize }
    }
  }

  const finalSize = minFont
  const charsPerLine = Math.max(10, Math.floor((boxWIn * 72) / (finalSize * avgCharWidthRatio)))
  const maxLines = Math.max(1, Math.floor((boxHIn * 72) / (finalSize * lineHeightRatio)))
  const lines = wrapTextByCharsCompact(text, charsPerLine)
  const clipped = lines.slice(0, Math.max(1, maxLines - 1))
  clipped.push("... continued")
  return { text: clipped.join("\n"), fontSize: finalSize }
}

const addCompactContentSlide = (
  pres: PptxPresentation,
  department: string,
  report: WeeklyReport,
  nextDept?: string,
  pageNumber?: number,
  theme: WeeklyPptxTheme = "light"
) => {
  const colors = getWeeklyPptxThemeColors(theme)
  const slide = pres.addSlide()
  slide.background = { color: colors.canvas }
  addWeeklyHeaderAndFooter(pres, slide, department, nextDept, pageNumber, theme)

  const boxes = getWeeklyContentBoxes()
  const workDoneText = autoNumberLines(report.work_done) || "No data provided."
  const tasksText = autoNumberLines(report.tasks_new_week) || "No data provided."
  const challengesText = autoNumberLines(report.challenges) || "No challenges reported."

  const workDoneFitted = fitTextToPptxBoxCompact(workDoneText, boxes.row1Left.textW, boxes.row1Left.textH)
  const tasksFitted = fitTextToPptxBoxCompact(tasksText, boxes.row1Right.textW, boxes.row1Right.textH)
  const challengesFitted = fitTextToPptxBoxCompact(challengesText, boxes.row2Full.textW, boxes.row2Full.textH)

  addSectionCard(
    pres,
    slide,
    boxes.row1Left,
    "WORK DONE",
    ACOB_GREEN,
    workDoneFitted.text,
    workDoneFitted.fontSize,
    false,
    false,
    theme
  )
  addSectionCard(
    pres,
    slide,
    boxes.row1Right,
    "TASKS FOR NEW WEEK",
    SECTION_TASKS,
    tasksFitted.text,
    tasksFitted.fontSize,
    false,
    false,
    theme
  )
  addSectionCard(
    pres,
    slide,
    boxes.row2Full,
    "CHALLENGES",
    SECTION_CHALLENGES,
    challengesFitted.text,
    challengesFitted.fontSize,
    false,
    false,
    theme
  )

  return slide
}

/** "On Work Done": one or more lines of "Name 3 / 4" entries under the Work Done card. */
const addTaskSummaryStrip = (
  pres: PptxPresentation,
  slide: PptxSlide,
  box: WeeklyContentBox,
  summary: WeeklyDeptTaskSummary,
  theme: WeeklyPptxTheme = "light"
) => {
  const colors = getWeeklyPptxThemeColors(theme)
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    fill: { color: colors.card },
    line: { color: colors.cardBorder, width: 1 },
  })
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: box.x,
    y: box.y,
    w: 0.07,
    h: box.h,
    fill: { color: colors.accent },
    line: { color: colors.accent, width: 0 },
  })

  const runs: PptxTextRun[] = [
    { text: PPTX_TASK_STRIP_LABEL, options: { bold: true, color: colors.textMuted, fontSize: 10, charSpacing: 2 } },
  ]
  if (summary.people.length === 0) {
    runs.push({ text: "No tasks were due or completed this week.", options: { color: colors.textMuted } })
  }
  summary.people.forEach((person, index) => {
    if (index > 0) runs.push({ text: PPTX_TASK_STRIP_SEPARATOR, options: { color: colors.textMuted } })
    // Non-breaking spaces keep each "Name 3 / 4" on one line; lines break only at separators.
    const nbsp = (text: string) => text.replace(/ /g, "\u00A0")
    runs.push({ text: nbsp(`${person.name} `), options: { color: colors.textPrimary } })
    runs.push({
      text: nbsp(formatTaskRatio(person)),
      options: { bold: true, color: getTaskRatioColor(person, theme) },
    })
  })

  slide.addText(runs, {
    x: box.x + 0.26,
    y: box.y + 0.05,
    w: box.textW,
    h: box.textH,
    fontSize: PPTX_TASK_STRIP_FONT_SIZE,
    valign: "middle",
    fontFace: "Calibri",
    lineSpacingMultiple: PPTX_WEEKLY_LINE_SPACING_MULTIPLE,
    fit: "shrink",
  })
}

/** Largest font that fits every person, one column before two (when the card is wide enough). */
const planTaskSummaryRows = (count: number, textH: number, maxColumns: number, maxFont = 14) => {
  for (const columns of maxColumns > 1 ? [1, 2] : [1]) {
    for (let fontSize = maxFont; fontSize >= PPTX_WEEKLY_MIN_BODY_FONT_SIZE; fontSize -= 1) {
      const rows = Math.max(1, Math.floor(textH / weeklyLineHeightIn(fontSize)))
      if (count <= rows * columns) return { fontSize, columns, rows }
    }
  }
  const fontSize = PPTX_WEEKLY_MIN_BODY_FONT_SIZE
  return { fontSize, columns: maxColumns, rows: Math.max(1, Math.floor(textH / weeklyLineHeightIn(fontSize))) }
}

/** "Beside Challenges": department total in the title, one row per person below. */
const addTaskSummaryCard = (
  pres: PptxPresentation,
  slide: PptxSlide,
  box: WeeklyContentBox,
  summary: WeeklyDeptTaskSummary,
  theme: WeeklyPptxTheme = "light"
) => {
  const colors = getWeeklyPptxThemeColors(theme)
  // The narrow Work Done column only has room for a short label beside the total.
  const isNarrow = box.w < 3
  const titleSize = isNarrow ? PPTX_TASK_SIDE_TITLE_SIZE : PPTX_WEEKLY_SECTION_TITLE_SIZE
  addSectionCardChrome(
    pres,
    slide,
    box,
    isNarrow ? "TASKS DONE" : "TASKS COMPLETED",
    colors.accent,
    theme,
    // Narrow column: the total runs straight after the label, unspaced, so the
    // two share the row without colliding.
    isNarrow ? { text: formatTaskRatio(summary), color: colors.textPrimary, compact: true } : undefined,
    titleSize
  )
  // Wide card: the total sits right-aligned at the end of the title row.
  if (!isNarrow) {
    slide.addText(formatTaskRatio(summary), {
      x: box.x + 0.26,
      y: box.y + 0.11,
      w: box.w - 0.5,
      h: 0.3,
      fontSize: titleSize,
      bold: true,
      color: colors.textPrimary,
      align: "right",
      valign: "middle",
      fontFace: "Calibri",
    })
  }

  const textX = box.x + 0.26
  const textY = box.y + 0.62
  const listH = box.textH
  if (summary.people.length === 0) {
    slide.addText("No tasks were due or completed this week.", {
      x: textX,
      y: textY,
      w: box.textW,
      h: listH,
      fontSize: PPTX_WEEKLY_BODY_FONT_SIZE,
      color: colors.textMuted,
      valign: "top",
      fontFace: "Calibri",
    })
    return
  }

  // A narrow side column holds one list; two would leave names a few letters wide.
  const maxColumns = box.textW >= 4 ? 2 : 1
  const { fontSize, columns, rows } = planTaskSummaryRows(
    summary.people.length,
    listH,
    maxColumns,
    isNarrow ? PPTX_TASK_SIDE_MAX_FONT : 14
  )
  const capacity = rows * columns
  const overflow = summary.people.length - capacity
  const shown = overflow > 0 ? summary.people.slice(0, capacity - 1) : summary.people

  const colGap = 0.2
  // textW leaves almost no right inset; right-aligned counts need a real one.
  const listW = box.textW - 0.14
  const colW = (listW - colGap * (columns - 1)) / columns
  const nameW = colW - PPTX_TASK_COUNT_COL_W
  const maxNameChars = charsPerLineAt(nameW, fontSize)
  // Names and counts are separate text boxes with identical font and spacing so
  // the rows line up; names are cut short rather than allowed to wrap, which
  // would push every later name off its count.
  const textOptions = {
    fontSize,
    valign: "top",
    fontFace: "Calibri",
    lineSpacingMultiple: PPTX_WEEKLY_LINE_SPACING_MULTIPLE,
    wrap: false,
  }

  for (let col = 0; col < columns; col += 1) {
    const people = shown.slice(col * rows, (col + 1) * rows)
    const nameRuns: PptxTextRun[] = people.map((person) => ({
      text: truncateToChars(person.name, maxNameChars),
      options: { color: colors.sectionText, breakLine: true },
    }))
    const countRuns: PptxTextRun[] = people.map((person) => ({
      text: formatTaskRatio(person),
      options: { bold: true, color: getTaskRatioColor(person, theme), breakLine: true },
    }))
    if (col === columns - 1 && overflow > 0) {
      nameRuns.push({ text: `+${overflow + 1} more`, options: { color: colors.textMuted, breakLine: true } })
    }
    if (nameRuns.length === 0) continue

    const colX = textX + col * (colW + colGap)
    slide.addText(nameRuns, { ...textOptions, x: colX, y: textY, w: nameW, h: listH, align: "left" })
    if (countRuns.length > 0) {
      slide.addText(countRuns, {
        ...textOptions,
        x: colX + nameW,
        y: textY,
        w: PPTX_TASK_COUNT_COL_W,
        h: listH,
        align: "right",
      })
    }
  }
}

const addWorkDoneSlide = (
  pres: PptxPresentation,
  department: string,
  workDonePlan: WeeklySectionPlan,
  nextDept?: string,
  pageNumber?: number,
  theme: WeeklyPptxTheme = "light",
  slidePosition?: { index: number; total: number },
  layout: WeeklyDepartmentLayout = getWeeklyDepartmentLayout(),
  taskSummary?: WeeklyTaskSummarySlot
) => {
  const colors = getWeeklyPptxThemeColors(theme)
  const slide = pres.addSlide()
  slide.background = { color: colors.canvas }
  addWeeklyHeaderAndFooter(pres, slide, department, nextDept, pageNumber, theme, slidePosition)

  const onWorkDone = taskSummary?.placement === "work_done" ? taskSummary.summary : undefined
  addSectionCard(
    pres,
    slide,
    layout.workDone,
    workDonePlan.title,
    workDonePlan.color,
    workDonePlan.text,
    workDonePlan.fontSize,
    true,
    false,
    theme,
    onWorkDone ? { text: `${formatTaskRatio(onWorkDone)} TASKS COMPLETED`, color: colors.textPrimary } : undefined
  )
  if (onWorkDone && layout.strip) {
    addTaskSummaryStrip(pres, slide, layout.strip, onWorkDone, theme)
  }
  if (taskSummary?.placement === "work_done_column" && layout.summary) {
    addTaskSummaryCard(pres, slide, layout.summary, taskSummary.summary, theme)
  }

  return slide
}

const addTasksAndChallengesSlide = (
  pres: PptxPresentation,
  department: string,
  tasksPlan: WeeklySectionPlan,
  challengesPlan: WeeklySectionPlan,
  nextDept?: string,
  pageNumber?: number,
  theme: WeeklyPptxTheme = "light",
  slidePosition?: { index: number; total: number },
  layout: WeeklyDepartmentLayout = getWeeklyDepartmentLayout(),
  taskSummary?: WeeklyTaskSummarySlot
) => {
  const colors = getWeeklyPptxThemeColors(theme)
  const slide = pres.addSlide()
  slide.background = { color: colors.canvas }
  addWeeklyHeaderAndFooter(pres, slide, department, nextDept, pageNumber, theme, slidePosition)

  addSectionCard(
    pres,
    slide,
    layout.tasks,
    tasksPlan.title,
    tasksPlan.color,
    tasksPlan.text,
    tasksPlan.fontSize,
    true,
    false,
    theme
  )
  addSectionCard(
    pres,
    slide,
    layout.challenges,
    challengesPlan.title,
    challengesPlan.color,
    challengesPlan.text,
    challengesPlan.fontSize,
    true,
    false,
    theme
  )
  if (taskSummary?.placement === "challenges" && layout.summary) {
    addTaskSummaryCard(pres, slide, layout.summary, taskSummary.summary, theme)
  }

  return slide
}

type DepartmentPptxPlan = {
  report: WeeklyReport
  layout: WeeklyDepartmentLayout
  taskSummary?: WeeklyTaskSummarySlot
  workDone: WeeklySectionPlan
  tasks: WeeklySectionPlan
  challenges: WeeklySectionPlan
  totalSlides: number
  startPage?: number
}

const buildDepartmentPptxPlan = (
  report: WeeklyReport,
  taskSummaryOptions?: WeeklyTaskSummaryOptions
): DepartmentPptxPlan => {
  const taskSummary = resolveTaskSummarySlot(report, taskSummaryOptions)
  const layout = getWeeklyDepartmentLayout(taskSummary)
  const [workDone, tasks, challenges] = getReportSectionPlans(report, layout)
  return {
    report,
    layout,
    taskSummary,
    workDone,
    tasks,
    challenges,
    totalSlides: 3, // title + work done page + tasks/challenges page
  }
}

const renderDepartmentWeeklySlides = (
  pres: PptxPresentation,
  departmentPlan: DepartmentPptxPlan,
  nextDepartmentName?: string,
  startPageNumber?: number,
  theme: WeeklyPptxTheme = "light",
  position?: { index: number; total: number }
) => {
  const { report, workDone, tasks, challenges, layout, taskSummary } = departmentPlan
  const p = Array.isArray(report.profiles) ? report.profiles[0] : report.profiles
  const name = p ? `${p.first_name} ${p.last_name}` : "Employee"

  let pageCursor = startPageNumber
  const titleSlide = addDeptTitleSlide(pres, report.department, name, pageCursor, theme, position)
  applyWeeklySlideTransition(titleSlide)
  if (typeof pageCursor === "number") pageCursor += 1

  // Both content slides advertise the *next department* in the footer. The
  // second slide used to show "NEXT: <this dept> 2" instead, which meant you
  // could not tell what was coming up until you were already on the last slide
  // of the department. Where you are within the department is now carried by
  // the "1 OF 2" / "2 OF 2" label in the header.
  const workDoneSlide = addWorkDoneSlide(
    pres,
    report.department,
    workDone,
    nextDepartmentName,
    pageCursor,
    theme,
    { index: 1, total: 2 },
    layout,
    taskSummary
  )
  applyWeeklySlideTransition(workDoneSlide)
  if (typeof pageCursor === "number") pageCursor += 1

  const tasksChallengesSlide = addTasksAndChallengesSlide(
    pres,
    report.department,
    tasks,
    challenges,
    nextDepartmentName,
    pageCursor,
    theme,
    { index: 2, total: 2 },
    layout,
    taskSummary
  )
  applyWeeklySlideTransition(tasksChallengesSlide)
}

const renderDepartmentCompactSlides = (
  pres: PptxPresentation,
  report: WeeklyReport,
  nextDepartmentName?: string,
  contentPageNumber?: number,
  theme: WeeklyPptxTheme = "light",
  position?: { index: number; total: number }
) => {
  const p = Array.isArray(report.profiles) ? report.profiles[0] : report.profiles
  const name = p ? `${p.first_name} ${p.last_name}` : "Employee"

  const titleSlide = addDeptTitleSlide(
    pres,
    report.department,
    name,
    typeof contentPageNumber === "number" ? contentPageNumber - 1 : undefined,
    theme,
    position
  )
  applyWeeklySlideTransition(titleSlide)

  const contentSlide = addCompactContentSlide(
    pres,
    report.department,
    report,
    nextDepartmentName,
    contentPageNumber,
    theme
  )
  applyWeeklySlideTransition(contentSlide)
}

// ─── Public Export Functions ──────────────────────────────────────────────────

export const exportToPPTX = async (
  report: WeeklyReport,
  mode: WeeklyPptxMode = "full",
  theme: WeeklyPptxTheme = "light",
  meetingDate?: string,
  taskSummaryOptions?: WeeklyTaskSummaryOptions
) => {
  const PptxConstructor = await loadPptxGenJS()
  const pres = new PptxConstructor()
  pres.layout = "LAYOUT_WIDE"

  // Slide 1 — Cover
  const coverSlide = addCoverSlide(pres, report.week_number, report.year, report.department, theme, meetingDate)
  applyWeeklySlideTransition(coverSlide)

  if (mode === "compact") {
    renderDepartmentCompactSlides(pres, report, undefined, 3, theme)
  } else {
    const departmentPlan = buildDepartmentPptxPlan(report, taskSummaryOptions)
    // Slides 2+ — Department title + full-mode content slides
    renderDepartmentWeeklySlides(pres, departmentPlan, undefined, 2, theme)
  }

  await pres.writeFile({
    fileName: buildWeeklyReportFilename({
      week: report.week_number,
      year: report.year,
      meetingDate,
      extension: "pptx",
      department: report.department,
      theme,
    }),
  })
}

export const exportAllToPPTX = async (
  reports: WeeklyReport[],
  week: number,
  year: number,
  mode: WeeklyPptxMode = "full",
  theme: WeeklyPptxTheme = "light",
  meetingDate?: string,
  order: WeeklyDeptOrder = "default",
  taskSummaryOptions?: WeeklyTaskSummaryOptions
) => {
  const PptxConstructor = await loadPptxGenJS()
  const pres = new PptxConstructor()
  pres.layout = "LAYOUT_WIDE"

  const sortedReports =
    order === "alpha"
      ? [...reports].sort((a, b) =>
          normalizeDepartmentName(a.department).localeCompare(normalizeDepartmentName(b.department))
        )
      : order === "random"
        ? shuffle(reports)
        : sortReportsByDepartment(reports)
  const departments = sortedReports.map((entry) => entry.department)

  // Slide 1 — Cover
  const coverSlide = addCoverSlide(pres, week, year, undefined, theme, meetingDate)
  applyWeeklySlideTransition(coverSlide)

  let pageCursor = 3
  const departmentStartPages: number[] = []
  if (mode === "compact") {
    sortedReports.forEach((_report) => {
      departmentStartPages.push(pageCursor)
      pageCursor += 2
    })
  } else {
    const departmentPlans = sortedReports.map((report) => buildDepartmentPptxPlan(report, taskSummaryOptions))
    departmentPlans.forEach((entry) => {
      departmentStartPages.push(pageCursor)
      entry.startPage = pageCursor
      pageCursor += entry.totalSlides
    })
  }

  // Slide 2 — Dept index
  const indexSlide = addDeptIndexSlide(
    pres,
    departments,
    week,
    year,
    (index) => departmentStartPages[index] ?? 3 + index * 2,
    theme
  )
  applyWeeklySlideTransition(indexSlide)

  if (mode === "compact") {
    sortedReports.forEach((report, idx) => {
      renderDepartmentCompactSlides(
        pres,
        report,
        sortedReports[idx + 1]?.department,
        departmentStartPages[idx] + 1,
        theme,
        { index: idx + 1, total: sortedReports.length }
      )
    })
  } else {
    const departmentPlans = sortedReports.map((report, idx) => {
      const entry = buildDepartmentPptxPlan(report, taskSummaryOptions)
      entry.startPage = departmentStartPages[idx]
      return entry
    })
    departmentPlans.forEach((departmentPlan, idx) => {
      renderDepartmentWeeklySlides(
        pres,
        departmentPlan,
        departmentPlans[idx + 1]?.report.department,
        departmentPlan.startPage,
        theme,
        { index: idx + 1, total: departmentPlans.length }
      )
    })
  }

  await pres.writeFile({
    fileName: buildWeeklyReportFilename({
      week,
      year,
      meetingDate,
      extension: "pptx",
      allDepartments: true,
      theme,
    }),
  })
}
