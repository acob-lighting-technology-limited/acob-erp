/**
 * General-meeting agenda deck: one PowerPoint that walks the standing agenda in
 * order — a section slide per item, the KSS as page images, last week's
 * summary of minutes as text slides, the weekly department slides, and the
 * birthday slide under Any Other Business. Everything is gathered client-side by the caller and passed
 * in; this module only lays slides out (pptxgenjs, loaded on demand).
 */
import { GENERAL_MEETING_AGENDA, type GeneralMeetingAgendaKey } from "@/lib/reports/general-meeting-agenda"
import type { WeeklyTaskSummaryOptions } from "@/lib/reports/weekly-task-summary"
import type { SlideTextBlock, SlideTextRun } from "@/lib/rich-text"
import {
  addCoverSlide,
  addWeeklyDepartmentSlides,
  applyWeeklySlideTransition,
  countWeeklyDepartmentSlides,
  fitTitleSlideFontSize,
  getWeeklyPptxThemeColors,
  TITLE_SLIDE_TEXT_W,
  WEEKLY_CONTENT_LAYOUT,
  type WeeklyPptxMode,
} from "./pptx"
import {
  ACOB_GREEN,
  EXPORT_LOGOS,
  formatMeetingDateForFilename,
  loadPptxGenJS,
  logoBoxByHeight,
  type PptxPresentation,
  type PptxSlide,
  type WeeklyDeptOrder,
  type WeeklyPptxTheme,
  type WeeklyReport,
} from "./shared"

const SLIDE_W = 13.33
const SLIDE_H = 7.5

export interface AgendaDeckImage {
  /** A data: URL (JPEG or PNG). */
  dataUrl: string
  width: number
  height: number
}

export interface AgendaDeckKssEntry {
  presenterName: string | null
  department: string | null
  /** Rendered PDF pages; empty when the file could not be turned into images. */
  pages: AgendaDeckImage[]
  /** Shown on the KSS section slide when `pages` is empty. */
  note?: string
}

export interface AgendaDeckBirthdaySlide {
  /** Screenshot of the /birthday design; null when it could not be captured. */
  image: AgendaDeckImage | null
  title: string
  note?: string
}

export interface AgendaDeckInput {
  week: number
  year: number
  meetingDate?: string
  mode: WeeklyPptxMode
  theme: WeeklyPptxTheme
  order: WeeklyDeptOrder
  taskSummaryOptions?: WeeklyTaskSummaryOptions
  reports: WeeklyReport[]
  kss: AgendaDeckKssEntry[]
  /** Without a summary the item is its title slide alone, with `note` saying why. */
  minutes: {
    summary?: SlideTextBlock[]
    label: string
    note?: string
  }
  birthdays: AgendaDeckBirthdaySlide[]
}

/** Agenda items are numbered in Roman numerals: I, II … VII. */
export const toRoman = (n: number) => {
  const numerals: [number, string][] = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ]
  let rest = n
  let out = ""
  for (const [value, numeral] of numerals) {
    while (rest >= value) {
      out += numeral
      rest -= value
    }
  }
  return out
}

/** Size at which a ghosted Roman numeral fits the 3.5" right of the title (I is narrow, V and X wide). */
const romanGhostFontSize = (numeral: string) => {
  const ems = [...numeral].reduce((total, ch) => total + (ch === "I" ? 0.27 : 0.6), 0)
  return Math.min(200, Math.floor((3.5 * 72) / ems))
}

/** pptxgenjs wants "image/jpeg;base64,…" without the data: scheme. */
const toPptxImageData = (dataUrl: string) => dataUrl.replace(/^data:/, "")

/** Largest box with the image's aspect ratio that fits inside the frame, centred in it. */
const containBox = (image: AgendaDeckImage, frame: { x: number; y: number; w: number; h: number }) => {
  const scale = Math.min(frame.w / image.width, frame.h / image.height)
  const w = image.width * scale
  const h = image.height * scale
  return { x: frame.x + (frame.w - w) / 2, y: frame.y + (frame.h - h) / 2, w, h }
}

/**
 * Agenda slides (the agenda and each item's section slide) are black with
 * small touches of ACOB green, so in the room they read as "next agenda item"
 * and can never be mistaken for the full-green department title slides inside
 * Departmental Updates. Same in both themes.
 */
const AGENDA_COLORS = {
  ink: "0A0A0A",
  inkDeep: "000000",
  ghost: "1A1A1A",
  /** Bright enough to read as text on black. */
  accent: "2FA257",
  /** ACOB green, for text on the light theme's off-white canvas. */
  accentOnLight: ACOB_GREEN,
  white: "FFFFFF",
  muted: "A3A3A3",
}

// Header and footer bars match the department slides', so the deck reads as one.
const { headerH: HEADER_H, footerY: FOOTER_Y, footerH: FOOTER_H } = WEEKLY_CONTENT_LAYOUT

/** Footer strip: wordmark, page number and, like the department slides, "NEXT:" on the right. */
const addFooterBand = (
  pres: PptxPresentation,
  slide: PptxSlide,
  pageNumber: number,
  colors: ReturnType<typeof getWeeklyPptxThemeColors>,
  band: { fill: string; text: string } = { fill: colors.footer, text: colors.textInverse },
  next?: string
) => {
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: 0,
    y: FOOTER_Y,
    w: "100%",
    h: FOOTER_H,
    fill: { color: band.fill },
    line: { color: band.fill },
  })
  const wordmarkBox = logoBoxByHeight(EXPORT_LOGOS.acobInverse, 0.28)
  try {
    slide.addImage({
      path: EXPORT_LOGOS.acobInverse.path,
      x: 0.3,
      y: FOOTER_Y + (FOOTER_H - wordmarkBox.h) / 2,
      ...wordmarkBox,
    })
  } catch {
    /* skip */
  }
  if (next) {
    slide.addText(`NEXT: ${next.toUpperCase()}`, {
      x: 7,
      y: FOOTER_Y,
      w: 6.1,
      h: FOOTER_H,
      fontSize: 10,
      bold: true,
      color: band.text,
      align: "right",
      valign: "middle",
      fontFace: "Calibri",
    })
  }
  slide.addText(String(pageNumber), {
    x: 0,
    y: FOOTER_Y,
    w: "100%",
    h: FOOTER_H,
    fontSize: 10,
    bold: true,
    color: band.text,
    align: "center",
    valign: "middle",
    fontFace: "Calibri",
  })
}

const AGENDA_FOOTER = { fill: AGENDA_COLORS.inkDeep, text: AGENDA_COLORS.accent }

/** Numbered agenda with the page each item starts on — the deck's table of contents. */
const addAgendaListSlide = (
  pres: PptxPresentation,
  items: { title: string; detail?: string; page: number }[],
  week: number,
  year: number,
  theme: WeeklyPptxTheme,
  next?: string
) => {
  const colors = getWeeklyPptxThemeColors(theme)
  const accent = theme === "dark" ? AGENDA_COLORS.accent : AGENDA_COLORS.accentOnLight
  const slide = pres.addSlide()
  slide.background = { color: colors.canvas }

  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: 0,
    y: 0,
    w: "100%",
    h: HEADER_H,
    fill: { color: AGENDA_COLORS.ink },
    line: { color: AGENDA_COLORS.ink },
  })
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: 0,
    y: HEADER_H,
    w: "100%",
    h: 0.05,
    fill: { color: AGENDA_COLORS.accent },
    line: { color: AGENDA_COLORS.accent },
  })
  slide.addText("AGENDA", {
    x: 0.3,
    y: 0,
    w: 10,
    h: HEADER_H,
    fontSize: 16,
    bold: true,
    color: AGENDA_COLORS.accent,
    charSpacing: 4,
    valign: "middle",
    fontFace: "Calibri",
  })
  slide.addText(`Week ${week}, ${year}`, {
    x: 10,
    y: 0,
    w: 3,
    h: HEADER_H,
    fontSize: 12,
    color: AGENDA_COLORS.muted,
    valign: "middle",
    align: "right",
    fontFace: "Calibri",
  })

  const startY = 1.15
  const rowH = 0.72
  items.forEach((item, i) => {
    const y = startY + i * rowH
    slide.addShape(pres.ShapeType?.ellipse ?? "ellipse", {
      x: 0.8,
      y: y + 0.1,
      w: 0.46,
      h: 0.46,
      fill: { color: AGENDA_COLORS.ink },
      line: { color: AGENDA_COLORS.accent, width: 1.5 },
    })
    slide.addText(toRoman(i + 1), {
      x: 0.8,
      y: y + 0.1,
      w: 0.46,
      h: 0.46,
      fontSize: 13,
      bold: true,
      color: AGENDA_COLORS.accent,
      align: "center",
      valign: "middle",
      fontFace: "Calibri",
    })
    slide.addText(
      [
        { text: item.title, options: { fontSize: 20, color: colors.textPrimary, fontFace: "Calibri" } },
        ...(item.detail
          ? [{ text: `   ${item.detail}`, options: { fontSize: 13, color: colors.textMuted, fontFace: "Calibri" } }]
          : []),
      ],
      { x: 1.5, y, w: 9.8, h: 0.66, valign: "middle", fontFace: "Calibri" }
    )
    slide.addText(String(item.page), {
      x: 11.2,
      y,
      w: 1.3,
      h: 0.66,
      fontSize: 16,
      bold: true,
      color: accent,
      align: "right",
      valign: "middle",
      fontFace: "Calibri",
    })
    if (i < items.length - 1) {
      slide.addShape(pres.ShapeType?.line ?? "line", {
        x: 0.8,
        y: y + rowH - 0.03,
        w: 11.7,
        h: 0,
        line: { color: colors.separator, width: 0.5 },
      })
    }
  })

  addFooterBand(pres, slide, 2, colors, AGENDA_FOOTER, next)
  return slide
}

/**
 * Black section slide for one agenda item: green eyebrow and short rule, and
 * the item number ghosted on the right. Items with
 * no content of their own (prayer, MD's remarks, closing) are just this slide.
 */
const addAgendaSectionSlide = (
  pres: PptxPresentation,
  {
    index,
    total,
    title,
    lines = [],
    pageNumber,
    theme,
    next,
  }: {
    index: number
    total: number
    title: string
    lines?: string[]
    pageNumber: number
    theme: WeeklyPptxTheme
    next?: string
  }
) => {
  const colors = getWeeklyPptxThemeColors(theme)
  const slide = pres.addSlide()
  slide.background = { color: AGENDA_COLORS.ink }
  const contentX = 1.05

  slide.addText(toRoman(index), {
    x: 6.9,
    y: 1.3,
    w: 5.9,
    h: 4.4,
    fontSize: romanGhostFontSize(toRoman(index)),
    bold: true,
    color: AGENDA_COLORS.ghost,
    align: "right",
    valign: "middle",
    fontFace: "Calibri",
  })

  slide.addText(`AGENDA ${toRoman(index)} OF ${toRoman(total)}`, {
    x: contentX,
    y: 2.75,
    w: 8,
    h: 0.36,
    fontSize: 14,
    bold: true,
    color: AGENDA_COLORS.accent,
    charSpacing: 4,
    valign: "middle",
    fontFace: "Calibri",
  })

  // Width stops short of the ghosted number, so a long title never runs into it.
  slide.addText(title, {
    x: contentX - 0.08,
    y: 3.17,
    w: TITLE_SLIDE_TEXT_W,
    h: 1.25,
    fontSize: fitTitleSlideFontSize(title),
    bold: true,
    color: AGENDA_COLORS.white,
    valign: "middle",
    fit: "shrink",
    fontFace: "Calibri",
  })

  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: contentX,
    y: 4.57,
    w: 2.6,
    h: 0.05,
    fill: { color: AGENDA_COLORS.accent },
    line: { color: AGENDA_COLORS.accent },
  })

  if (lines.length > 0) {
    slide.addText(lines.join("\n"), {
      x: contentX,
      y: 4.8,
      w: 11,
      h: 1.6,
      fontSize: 18,
      color: AGENDA_COLORS.muted,
      valign: "top",
      paraSpaceAfter: 4,
      fontFace: "Calibri",
    })
  }

  addFooterBand(pres, slide, pageNumber, colors, AGENDA_FOOTER, next)
  applyWeeklySlideTransition(slide)
  return slide
}

/** A KSS page: the presenter's slide shown edge to edge on a black canvas. */
const addPresentationPageSlide = (pres: PptxPresentation, image: AgendaDeckImage) => {
  const slide = pres.addSlide()
  slide.background = { color: "000000" }
  slide.addImage({ data: toPptxImageData(image.dataUrl), ...containBox(image, { x: 0, y: 0, w: SLIDE_W, h: SLIDE_H }) })
  return slide
}

// Summary text slides, in the area between the header bar and the footer. Sizes
// follow the department slides (16pt header title, 12pt card titles, 14pt body),
// so no line outranks the slide's own title. Hierarchy comes from colour, weight
// and spacing: section headings lead, labels are a small eyebrow, replies sit
// indented under their point.
const SUMMARY_BOX = { x: 0.7, y: 0.8, w: SLIDE_W - 1.4, h: 6.05 }
const SUMMARY_PT: Record<SlideTextBlock["kind"], number> = {
  heading: 16,
  label: 12,
  paragraph: 14,
  bullet: 14,
  number: 14,
  reply: 13,
}
/** Hanging indent for points and replies (points), and the matching estimate (inches). */
const SUMMARY_LIST_INDENT_PT = 24
const SUMMARY_LIST_INDENT_IN = SUMMARY_LIST_INDENT_PT / 72
const SUMMARY_PARA_GAP_IN = 0.08
/** Space above a section heading or label, so each section reads as its own block. */
const SUMMARY_SPACE_BEFORE_PT: Partial<Record<SlideTextBlock["kind"], number>> = { heading: 12, label: 6 }

/**
 * Estimated height of a block (pptxgenjs cannot measure text). 18pt Calibri
 * measured about 0.43 em per character in PowerPoint; 0.45 leaves a margin.
 */
const slideTextMetrics = (block: SlideTextBlock) => {
  const size = SUMMARY_PT[block.kind]
  const indented = block.kind === "bullet" || block.kind === "number" || block.kind === "reply"
  const width = SUMMARY_BOX.w - (indented ? SUMMARY_LIST_INDENT_IN : 0)
  return { lineHeight: (size * 1.2) / 72, charsPerLine: Math.max(10, Math.floor((width * 72) / (size * 0.45))) }
}

const slideTextBlockHeight = (block: SlideTextBlock) => {
  const { lineHeight, charsPerLine } = slideTextMetrics(block)
  const text = block.runs.map((run) => run.text).join("")
  const lines = text.split("\n").reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charsPerLine)), 0)
  return lines * lineHeight + SUMMARY_PARA_GAP_IN + (SUMMARY_SPACE_BEFORE_PT[block.kind] ?? 0) / 72
}

/**
 * A block taller than the whole text area, split into pieces that each fit a
 * slide. Breaks between words, after a sentence where one falls in the second
 * half of a piece. Continuations of a list item carry no second marker.
 */
const splitOversizedBlock = (block: SlideTextBlock): SlideTextBlock[] => {
  if (slideTextBlockHeight(block) <= SUMMARY_BOX.h) return [block]
  const { lineHeight, charsPerLine } = slideTextMetrics(block)
  // Word wrap leaves part of every line empty; 0.9 keeps the estimate on the safe side.
  const maxChars = Math.floor(charsPerLine * Math.floor((SUMMARY_BOX.h - SUMMARY_PARA_GAP_IN) / lineHeight) * 0.9)
  const words = block.runs.flatMap((run) =>
    run.text.split(/(?<=\s)/).map((text) => ({ ...run, text: text.replace(/\n/g, " ") }))
  )

  const pieces: SlideTextBlock[] = []
  let start = 0
  while (start < words.length) {
    let end = start
    let length = 0
    let sentenceEnd = -1
    while (end < words.length && (end === start || length + words[end].text.length <= maxChars)) {
      length += words[end].text.length
      if (/[.!?;:]\s*$/.test(words[end].text) && length > maxChars / 2) sentenceEnd = end + 1
      end++
    }
    if (end < words.length && sentenceEnd > start) end = sentenceEnd
    const runs = words.slice(start, end).reduce<SlideTextRun[]>((merged, word) => {
      const last = merged[merged.length - 1]
      if (last && !!last.bold === !!word.bold && !!last.italic === !!word.italic) last.text += word.text
      else merged.push({ ...word })
      return merged
    }, [])
    runs[runs.length - 1].text = runs[runs.length - 1].text.trimEnd()
    pieces.push({ ...block, runs, ...(pieces.length > 0 && { continued: true }) })
    start = end
  }
  return pieces
}

/**
 * Splits the summary into slides that fit the text area, breaking between
 * paragraphs (and inside one only when it is taller than a slide), and never
 * leaving a heading alone at the bottom of a slide.
 */
export const paginateSlideText = (input: SlideTextBlock[]): SlideTextBlock[][] => {
  const blocks = input.flatMap(splitOversizedBlock)
  const slides: SlideTextBlock[][] = []
  let current: SlideTextBlock[] = []
  let used = 0
  blocks.forEach((block, i) => {
    const height = slideTextBlockHeight(block)
    const next = blocks[i + 1]
    // A heading needs room for itself and the first block it introduces.
    const needed = block.kind === "heading" && next ? height + slideTextBlockHeight(next) : height
    if (current.length > 0 && used + needed > SUMMARY_BOX.h) {
      slides.push(current)
      current = []
      used = 0
    }
    current.push(block)
    used += height
  })
  if (current.length > 0) slides.push(current)
  return slides
}

/** One slide of the summary of minutes, as real (editable) text. */
const addSummaryTextSlide = (
  pres: PptxPresentation,
  blocks: SlideTextBlock[],
  title: string,
  pageLabel: string,
  pageNumber: number,
  theme: WeeklyPptxTheme,
  next?: string
) => {
  const colors = getWeeklyPptxThemeColors(theme)
  const slide = pres.addSlide()
  slide.background = { color: colors.canvas }
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: 0,
    y: 0,
    w: "100%",
    h: HEADER_H,
    fill: { color: colors.header },
    line: { color: colors.header },
  })
  slide.addText(title, {
    x: 0.3,
    y: 0,
    w: 10,
    h: HEADER_H,
    fontSize: 16,
    bold: true,
    color: colors.textInverse,
    valign: "middle",
    fontFace: "Calibri",
  })
  slide.addText(pageLabel, {
    x: 10,
    y: 0,
    w: 3,
    h: HEADER_H,
    fontSize: 12,
    color: colors.headerMuted,
    valign: "middle",
    align: "right",
    fontFace: "Calibri",
  })

  // Body a step quieter than pure white/black, so headings lead.
  const bodyColor = theme === "dark" ? "D4D4D4" : "334155"
  // The agenda slides' green: brighter on dark so headings carry on black.
  const headingColor = theme === "dark" ? AGENDA_COLORS.accent : AGENDA_COLORS.accentOnLight
  const paragraphs = blocks.flatMap((block, index) => {
    const isHeading = block.kind === "heading"
    const isLabel = block.kind === "label"
    const isReply = block.kind === "reply"
    const spaceBefore = index > 0 ? SUMMARY_SPACE_BEFORE_PT[block.kind] : undefined
    const paragraph = {
      fontSize: SUMMARY_PT[block.kind],
      color: isHeading || isLabel ? headingColor : isReply ? colors.textMuted : bodyColor,
      paraSpaceAfter: isHeading ? 3 : 5,
      ...(spaceBefore && { paraSpaceBefore: spaceBefore }),
      ...(isLabel && { charSpacing: 2 }),
      ...(isReply && { italic: true }),
    }
    // Points hang their number in the margin. A reply hangs an invisible
    // character the same way, which is the only way pptxgenjs indents a paragraph.
    const bullet = block.continued
      ? null
      : block.kind === "bullet"
        ? { indent: SUMMARY_LIST_INDENT_PT }
        : block.kind === "number"
          ? {
              type: "number",
              style: block.numberStyle ?? "arabicPeriod",
              numberStartAt: block.number ?? 1,
              indent: SUMMARY_LIST_INDENT_PT,
            }
          : isReply
            ? { characterCode: "00A0", indent: SUMMARY_LIST_INDENT_PT }
            : null
    const runs = block.runs.flatMap((run) =>
      run.text.split("\n").map((text, k) => ({ ...run, text, softBreak: k > 0 }))
    )
    // pptxgenjs starts a new paragraph at every run carrying `bullet`, and drops
    // `breakLine` from such runs. So the bullet goes on the first run only, and a
    // one-run list item gets an empty run to carry the paragraph break; without
    // it the next block would run on into this one.
    const items: { text: string; options: Record<string, unknown> }[] = runs.map((run, k) => ({
      text: run.text,
      options: {
        ...paragraph,
        bold: isHeading || isLabel || run.bold,
        italic: isReply || run.italic,
        ...(k === 0 && bullet && { bullet }),
        ...(run.softBreak && { softBreakBefore: true }),
      },
    }))
    if (bullet && items.length === 1) items.push({ text: "", options: { ...paragraph } })
    items[items.length - 1].options.breakLine = true
    return items
  })
  slide.addText(paragraphs, { ...SUMMARY_BOX, valign: "top", fontFace: "Calibri", margin: 0 })

  addFooterBand(pres, slide, pageNumber, colors, undefined, next)
  return slide
}

/** Birthday slide: the /birthday screenshot full-bleed, or a plain note when it is missing. */
const addBirthdaySlide = (pres: PptxPresentation, entry: AgendaDeckBirthdaySlide) => {
  const slide = pres.addSlide()
  slide.background = { color: "050806" }
  if (entry.image) {
    slide.addImage({
      data: toPptxImageData(entry.image.dataUrl),
      ...containBox(entry.image, { x: 0, y: 0, w: SLIDE_W, h: SLIDE_H }),
    })
  } else {
    slide.addText(entry.title, {
      x: 0.8,
      y: 2.6,
      w: SLIDE_W - 1.6,
      h: 1,
      fontSize: 40,
      bold: true,
      color: "E8BD4F",
      align: "center",
      valign: "middle",
      fontFace: "Calibri",
    })
    if (entry.note) {
      slide.addText(entry.note, {
        x: 0.8,
        y: 3.7,
        w: SLIDE_W - 1.6,
        h: 0.8,
        fontSize: 18,
        color: "A9B8AD",
        align: "center",
        valign: "middle",
        fontFace: "Calibri",
      })
    }
  }
  applyWeeklySlideTransition(slide)
  return slide
}

/** Slides each agenda item contributes after its section slide. */
const contentSlideCount = (key: GeneralMeetingAgendaKey, input: AgendaDeckInput) => {
  switch (key) {
    case "kss":
      return input.kss.reduce((total, entry) => total + entry.pages.length, 0)
    case "minutes":
      return input.minutes.summary ? paginateSlideText(input.minutes.summary).length : 0
    case "departments":
      return input.reports.length > 0
        ? countWeeklyDepartmentSlides(input.reports, input.mode, input.taskSummaryOptions)
        : 0
    case "aob":
      return input.birthdays.length
    default:
      return 0
  }
}

const kssSectionLines = (input: AgendaDeckInput) => {
  if (input.kss.length === 0) return ["No KSS file has been uploaded for this week."]
  return input.kss.map((entry) => {
    const who = [entry.presenterName, entry.department].filter(Boolean).join(" · ") || "Presenter not recorded"
    return entry.pages.length > 0 ? who : `${who} — ${entry.note ?? "presented from their own file"}`
  })
}

export const buildAgendaDeckFilename = (week: number, year: number, meetingDate?: string, theme?: WeeklyPptxTheme) =>
  [
    "ACOB General Meeting",
    formatMeetingDateForFilename(week, year, meetingDate),
    `W${week}`,
    theme === "dark" ? "Dark Theme" : null,
  ]
    .filter(Boolean)
    .join(" - ") + ".pptx"

/** Page each agenda item's section slide lands on. Cover = 1, agenda = 2. */
export const planAgendaDeckPages = (input: AgendaDeckInput) => {
  let cursor = 3
  const startPages = GENERAL_MEETING_AGENDA.map((item) => {
    const start = cursor
    cursor += 1 + contentSlideCount(item.key, input)
    return start
  })
  return { startPages, totalSlides: cursor - 1 }
}

/** Lays the whole deck out on `pres`. Split from the export so it can be tested without writing a file. */
export const buildAgendaDeck = (pres: PptxPresentation, input: AgendaDeckInput) => {
  const { week, year, theme } = input
  const total = GENERAL_MEETING_AGENDA.length
  const { startPages } = planAgendaDeckPages(input)

  applyWeeklySlideTransition(addCoverSlide(pres, week, year, undefined, theme, input.meetingDate, "Weekly Meeting"))
  applyWeeklySlideTransition(
    addAgendaListSlide(
      pres,
      GENERAL_MEETING_AGENDA.map((item, i) => ({
        title: item.title,
        detail: "detail" in item ? item.detail : undefined,
        page: startPages[i],
      })),
      week,
      year,
      theme,
      GENERAL_MEETING_AGENDA[0]?.title
    )
  )

  GENERAL_MEETING_AGENDA.forEach((item, i) => {
    const page = startPages[i]
    const next = GENERAL_MEETING_AGENDA[i + 1]?.title
    const section = { index: i + 1, total, title: item.title, pageNumber: page, theme, next }

    switch (item.key) {
      case "kss": {
        addAgendaSectionSlide(pres, { ...section, lines: kssSectionLines(input) })
        input.kss.forEach((entry) => entry.pages.forEach((image) => addPresentationPageSlide(pres, image)))
        break
      }
      case "minutes": {
        const { summary, label, note } = input.minutes
        addAgendaSectionSlide(pres, { ...section, lines: summary ? [label] : [note ?? label] })
        const summarySlides = summary ? paginateSlideText(summary) : []
        summarySlides.forEach((blocks, n) =>
          addSummaryTextSlide(pres, blocks, label, `${n + 1} of ${summarySlides.length}`, page + 1 + n, theme, next)
        )
        break
      }
      case "departments": {
        if (input.reports.length === 0) {
          addAgendaSectionSlide(pres, { ...section, lines: ["No weekly reports were submitted for this week."] })
          break
        }
        addAgendaSectionSlide(pres, {
          ...section,
          lines: [`${input.reports.length} department${input.reports.length === 1 ? "" : "s"} reporting`],
        })
        addWeeklyDepartmentSlides(pres, input.reports, {
          week,
          year,
          mode: input.mode,
          theme,
          order: input.order,
          taskSummaryOptions: input.taskSummaryOptions,
          firstPage: page + 1,
          nextAfterLast: next,
        })
        break
      }
      case "aob": {
        addAgendaSectionSlide(pres, { ...section, lines: input.birthdays.map((entry) => entry.title) })
        input.birthdays.forEach((entry) => addBirthdaySlide(pres, entry))
        break
      }
      default:
        addAgendaSectionSlide(pres, section)
    }
  })
}

export const exportAgendaDeckToPPTX = async (input: AgendaDeckInput) => {
  const PptxConstructor = await loadPptxGenJS()
  const pres = new PptxConstructor()
  pres.layout = "LAYOUT_WIDE"
  buildAgendaDeck(pres, input)
  await pres.writeFile({ fileName: buildAgendaDeckFilename(input.week, input.year, input.meetingDate, input.theme) })
}
