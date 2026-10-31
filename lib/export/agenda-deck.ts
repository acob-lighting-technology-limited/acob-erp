/**
 * General-meeting agenda deck: one PowerPoint that walks the standing agenda in
 * order — a section slide per item, the KSS and last week's minutes as page
 * images, the weekly department slides, and the two birthday slides under Any
 * Other Business. Everything is gathered client-side by the caller and passed
 * in; this module only lays slides out (pptxgenjs, loaded on demand).
 */
import { GENERAL_MEETING_AGENDA, type GeneralMeetingAgendaKey } from "@/lib/reports/general-meeting-agenda"
import type { WeeklyTaskSummaryOptions } from "@/lib/reports/weekly-task-summary"
import {
  addCoverSlide,
  addWeeklyDepartmentSlides,
  applyWeeklySlideTransition,
  countWeeklyDepartmentSlides,
  getWeeklyPptxThemeColors,
  type WeeklyPptxMode,
} from "./pptx"
import {
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
  minutes: { pages: AgendaDeckImage[]; label: string; note?: string }
  birthdays: AgendaDeckBirthdaySlide[]
}

const pad2 = (n: number) => String(n).padStart(2, "0")

/** pptxgenjs wants "image/jpeg;base64,…" without the data: scheme. */
const toPptxImageData = (dataUrl: string) => dataUrl.replace(/^data:/, "")

/** Largest box with the image's aspect ratio that fits inside the frame, centred in it. */
const containBox = (image: AgendaDeckImage, frame: { x: number; y: number; w: number; h: number }) => {
  const scale = Math.min(frame.w / image.width, frame.h / image.height)
  const w = image.width * scale
  const h = image.height * scale
  return { x: frame.x + (frame.w - w) / 2, y: frame.y + (frame.h - h) / 2, w, h }
}

const addFooterBand = (
  pres: PptxPresentation,
  slide: PptxSlide,
  pageNumber: number,
  colors: ReturnType<typeof getWeeklyPptxThemeColors>
) => {
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: 0,
    y: 6.9,
    w: "100%",
    h: 0.6,
    fill: { color: colors.footer },
    line: { color: colors.footer },
  })
  const wordmarkBox = logoBoxByHeight(EXPORT_LOGOS.acobInverse, 0.34)
  try {
    slide.addImage({ path: EXPORT_LOGOS.acobInverse.path, x: 0.55, y: 6.98, ...wordmarkBox })
  } catch {
    /* skip */
  }
  slide.addText(String(pageNumber), {
    x: 0,
    y: 6.9,
    w: "100%",
    h: 0.6,
    fontSize: 10,
    bold: true,
    color: colors.textInverse,
    align: "center",
    valign: "middle",
    fontFace: "Calibri",
  })
}

/** Numbered agenda with the page each item starts on — the deck's table of contents. */
const addAgendaListSlide = (
  pres: PptxPresentation,
  items: { title: string; detail?: string; page: number }[],
  week: number,
  year: number,
  theme: WeeklyPptxTheme
) => {
  const colors = getWeeklyPptxThemeColors(theme)
  const slide = pres.addSlide()
  slide.background = { color: colors.canvas }

  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: 0,
    y: 0,
    w: "100%",
    h: 0.65,
    fill: { color: colors.header },
    line: { color: colors.header },
  })
  slide.addText("Agenda", {
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
    color: colors.headerMuted,
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
      fill: { color: colors.accent },
      line: { color: colors.accent },
    })
    slide.addText(String(i + 1), {
      x: 0.8,
      y: y + 0.1,
      w: 0.46,
      h: 0.46,
      fontSize: 13,
      bold: true,
      color: colors.textInverse,
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
      color: colors.accent,
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

  addFooterBand(pres, slide, 2, colors)
  return slide
}

/**
 * Full-bleed green section slide for one agenda item, in the same style as the
 * weekly export's department title slides. Items with no content of their own
 * (prayer, MD's remarks, closing) are just this slide.
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
  }: { index: number; total: number; title: string; lines?: string[]; pageNumber: number; theme: WeeklyPptxTheme }
) => {
  const colors = getWeeklyPptxThemeColors(theme)
  const slide = pres.addSlide()
  slide.background = { color: colors.titleFill }
  const contentX = 1.05

  slide.addText(pad2(index), {
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

  slide.addText(`AGENDA ${pad2(index)} OF ${pad2(total)}`, {
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

  slide.addText(title.toUpperCase(), {
    x: contentX - 0.08,
    y: 3.17,
    w: 11.5,
    h: 1.25,
    fontSize: title.length > 26 ? 44 : 54,
    bold: true,
    color: colors.textInverse,
    valign: "middle",
    fit: "shrink",
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

  if (lines.length > 0) {
    slide.addText(lines.join("\n"), {
      x: contentX,
      y: 4.8,
      w: 11,
      h: 1.6,
      fontSize: 18,
      color: colors.textInverse,
      valign: "top",
      paraSpaceAfter: 4,
      fontFace: "Calibri",
    })
  }

  addFooterBand(pres, slide, pageNumber, colors)
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

/** A minutes page: the A4 page centred under a header naming the document and page. */
const addDocumentPageSlide = (
  pres: PptxPresentation,
  image: AgendaDeckImage,
  title: string,
  pageLabel: string,
  pageNumber: number,
  theme: WeeklyPptxTheme
) => {
  const colors = getWeeklyPptxThemeColors(theme)
  const slide = pres.addSlide()
  slide.background = { color: colors.canvas }
  slide.addShape(pres.ShapeType?.rect ?? "rect", {
    x: 0,
    y: 0,
    w: "100%",
    h: 0.65,
    fill: { color: colors.header },
    line: { color: colors.header },
  })
  slide.addText(title, {
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
  slide.addText(pageLabel, {
    x: 10,
    y: 0,
    w: 3,
    h: 0.65,
    fontSize: 12,
    color: colors.headerMuted,
    valign: "middle",
    align: "right",
    fontFace: "Calibri",
  })
  slide.addImage({
    data: toPptxImageData(image.dataUrl),
    ...containBox(image, { x: 0.3, y: 0.8, w: SLIDE_W - 0.6, h: 6.9 - 0.8 - 0.1 }),
  })
  addFooterBand(pres, slide, pageNumber, colors)
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
      return input.minutes.pages.length
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
      theme
    )
  )

  GENERAL_MEETING_AGENDA.forEach((item, i) => {
    const page = startPages[i]
    const section = { index: i + 1, total, title: item.title, pageNumber: page, theme }

    switch (item.key) {
      case "kss": {
        addAgendaSectionSlide(pres, { ...section, lines: kssSectionLines(input) })
        input.kss.forEach((entry) => entry.pages.forEach((image) => addPresentationPageSlide(pres, image)))
        break
      }
      case "minutes": {
        const { pages, label, note } = input.minutes
        addAgendaSectionSlide(pres, { ...section, lines: [pages.length > 0 ? label : (note ?? label)] })
        pages.forEach((image, n) =>
          addDocumentPageSlide(pres, image, label, `Page ${n + 1} of ${pages.length}`, page + 1 + n, theme)
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
