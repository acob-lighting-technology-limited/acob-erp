import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import { Resend } from "npm:resend@2.0.0"
import { PDFDocument, rgb, StandardFonts } from "npm:pdf-lib@1.17.1"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const GREEN = rgb(0.102, 0.478, 0.29)
const DARK = rgb(0.059, 0.176, 0.122)
const WHITE = rgb(1, 1, 1)
const SLATE = rgb(0.2, 0.255, 0.333)
const MUTED = rgb(0.392, 0.455, 0.545)
const BLUE = rgb(0.114, 0.416, 0.588)
const RED = rgb(0.725, 0.11, 0.11)
const LIGHT = rgb(0.976, 0.984, 0.992)
const RESEND_MAX_REQ_PER_SEC = 2
const SEND_INTERVAL_MS = Math.ceil(1000 / RESEND_MAX_REQ_PER_SEC) + 100 // ~0.6s with safety margin
const MAX_429_RETRIES = 5

const OFFICE_WEEK_ANCHOR_MONTH_INDEX = 0
const OFFICE_WEEK_ANCHOR_DAY = 12

function getOfficeYearStart(year: number): Date {
  return new Date(year, OFFICE_WEEK_ANCHOR_MONTH_INDEX, OFFICE_WEEK_ANCHOR_DAY)
}

function getCurrentOfficeWeek(): { week: number; year: number } {
  return getOfficeWeekFromDate(new Date())
}

function getOfficeWeekFromDate(date: Date): { week: number; year: number } {
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

function getWeekMonday(week: number, year: number): string {
  const monday = new Date(getOfficeYearStart(year))
  monday.setDate(monday.getDate() + (week - 1) * 7)
  return formatDateWithOrdinal(monday)
}

function formatDateWithOrdinal(date: Date): string {
  const day = date.getDate()
  const suffix = [1, 21, 31].includes(day) ? "st" : [2, 22].includes(day) ? "nd" : [3, 23].includes(day) ? "rd" : "th"
  const month = date.toLocaleString("en-GB", { month: "long" })
  return `${day}${suffix} ${month}, ${date.getFullYear()}`
}

function getNextMeetingDate(week: number, year: number): string {
  const monday = new Date(getOfficeYearStart(year))
  monday.setDate(monday.getDate() + (week - 1) * 7)
  monday.setDate(monday.getDate() + 7)
  return formatDateWithOrdinal(monday)
}

const DEPT_ORDER = [
  "Accounts",
  "Business, Growth and Innovation",
  "IT and Communications",
  "Admin & HR",
  "Legal, Regulatory and Compliance",
  "Operations",
  "Technical",
]

function autoNumber(text: string): string {
  if (!text?.trim()) return ""
  const lines = text.split("\n").filter((l) => l.trim())
  if (lines[0]?.match(/^\d+\.\s/)) return lines.join("\n")
  return lines.map((l, i) => `${i + 1}. ${l.trim()}`).join("\n")
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ")
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars) {
      if (current) lines.push(current.trim())
      current = word
    } else {
      current = current ? current + " " + word : word
    }
  }
  if (current) lines.push(current.trim())
  return lines
}

function sanitizeForPdf(text: string, font: any): string {
  if (!text) return ""
  let out = ""
  for (const ch of text) {
    if (ch === "\r") continue
    if (ch === "\n") {
      out += "\n"
      continue
    }
    if (ch === "\t") {
      out += " "
      continue
    }
    try {
      font.encodeText(ch)
      out += ch
    } catch {
      // Drop unsupported characters (e.g. U+2060 WORD JOINER).
    }
  }
  return out
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRateLimitError(error: any): boolean {
  if (!error) return false
  const statusCode = Number(error?.statusCode || error?.status || 0)
  const name = String(error?.name || "").toLowerCase()
  const msg = String(error?.message || "").toLowerCase()
  return statusCode === 429 || name.includes("rate_limit") || msg.includes("too many requests")
}

async function sendWithRetry(
  resend: Resend,
  payload: {
    from: string
    to: string
    subject: string
    html: string
    attachments: { filename: string; content: string }[]
  }
): Promise<{ data?: any; error?: any }> {
  let attempt = 0
  while (attempt <= MAX_429_RETRIES) {
    const { data, error } = await resend.emails.send(payload)
    if (!error) return { data }
    if (!isRateLimitError(error) || attempt === MAX_429_RETRIES) return { error }
    const backoffMs = 1000 * (attempt + 1)
    console.warn(`[digest] Rate limit for ${payload.to}. Retry ${attempt + 1}/${MAX_429_RETRIES} in ${backoffMs}ms`)
    await sleep(backoffMs)
    attempt += 1
  }
  return { error: { message: "Unexpected retry flow termination" } }
}

const STORAGE_BASE = "https://itqegqxeqkeogwrvlzlj.supabase.co/storage/v1/object/public/assets/logos"

async function fetchLogoBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return new Uint8Array(await res.arrayBuffer())
  } catch {
    return null
  }
}

async function drawLogoInHeader(
  doc: PDFDocument,
  page: any,
  logoBytes: Uint8Array | null,
  headerH: number,
  H: number,
  W: number
) {
  if (!logoBytes) return
  try {
    const img = await doc.embedPng(logoBytes)
    const dims = img.scaleToFit(108, 26)
    page.drawImage(img, {
      x: W - dims.width - 17,
      y: H - headerH + (headerH - dims.height) / 2,
      width: dims.width,
      height: dims.height,
    })
  } catch {
    /* skip if embed fails */
  }
}

// ─── Cover page ───────────────────────────────────────────────────────────────
async function addCoverPage(
  doc: PDFDocument,
  bold: any,
  regular: any,
  week: number,
  year: number,
  subtitle: string,
  secondaryTitle = "Weekly Report",
  coverLogoBytes: Uint8Array | null
) {
  const page = doc.addPage([595, 842])
  const { width: W, height: H } = page.getSize()
  const mondayDate = getWeekMonday(week, year)

  // Dark header bar
  page.drawRectangle({ x: 0, y: H - 60, width: W, height: 60, color: DARK })
  page.drawRectangle({ x: 0, y: H - 66, width: W, height: 6, color: GREEN })

  // Large centred LIGHT logo in body area
  if (coverLogoBytes) {
    try {
      const img = await doc.embedPng(coverLogoBytes)
      const dims = img.scaleToFit(350, 80)
      page.drawImage(img, {
        x: W / 2 - dims.width / 2,
        y: H / 2 + 80,
        width: dims.width,
        height: dims.height,
      })
    } catch {
      /* skip */
    }
  } else {
    page.drawText("ACOB LIGHTING TECHNOLOGY LIMITED", {
      x: W / 2 - 150,
      y: H / 2 + 90,
      size: 14,
      font: bold,
      color: DARK,
    })
  }

  // Green divider below logo
  page.drawRectangle({ x: 80, y: H / 2 + 60, width: W - 160, height: 2, color: GREEN })

  // Centre content
  const gmText = "General Meeting"
  const gmWidth = bold.widthOfTextAtSize(gmText, 28)
  page.drawText(gmText, { x: W / 2 - gmWidth / 2, y: H / 2 + 24, size: 28, font: bold, color: DARK })

  const wrText = secondaryTitle
  const wrWidth = regular.widthOfTextAtSize(wrText, 20)
  page.drawText(wrText, { x: W / 2 - wrWidth / 2, y: H / 2 + 2, size: 20, font: regular, color: GREEN })

  // Week pill
  const pillLabel = `Week ${week}`
  const pillLabelW = bold.widthOfTextAtSize(pillLabel, 12)
  const pillW = pillLabelW + 36,
    pillH = 24
  const pillX = W / 2 - pillW / 2,
    pillY = H / 2 - 36
  page.drawRectangle({ x: pillX, y: pillY, width: pillW, height: pillH, color: GREEN })
  page.drawText(pillLabel, { x: pillX + 18, y: pillY + 7, size: 12, font: bold, color: WHITE })

  // Monday date — properly centred
  const dateWidth = regular.widthOfTextAtSize(mondayDate, 10)
  page.drawText(mondayDate, { x: W / 2 - dateWidth / 2, y: pillY - 22, size: 10, font: regular, color: MUTED })

  if (subtitle) {
    const stWidth = regular.widthOfTextAtSize(subtitle, 10)
    page.drawText(subtitle, { x: W / 2 - stWidth / 2, y: pillY - 42, size: 10, font: regular, color: GREEN })
  }

  // Footer
  page.drawRectangle({ x: 0, y: 0, width: W, height: 40, color: GREEN })
  page.drawText("Confidential \u2014 ACOB Internal Use Only", {
    x: W / 2 - 110,
    y: 14,
    size: 8,
    font: regular,
    color: WHITE,
  })
}

async function addTOCPage(
  doc: PDFDocument,
  bold: any,
  regular: any,
  title: string,
  entries: string[],
  headerLogoBytes: Uint8Array | null
) {
  const page = doc.addPage([595, 842])
  const { width: W, height: H } = page.getSize()
  const headerH = 52
  const footerH = 40

  page.drawRectangle({ x: 0, y: H - headerH, width: W, height: headerH, color: DARK })
  page.drawRectangle({ x: 0, y: H - headerH - 4, width: W, height: 4, color: GREEN })
  page.drawText("Departments in This Report", { x: 22, y: H - 32, size: 9, font: bold, color: WHITE })
  const weekLabel = title.match(/Week\s+\d+,\s*\d+/i)?.[0] ?? ""
  if (weekLabel) {
    const weekW = regular.widthOfTextAtSize(weekLabel, 8)
    page.drawText(weekLabel, { x: W - 22 - weekW, y: H - 32, size: 8, font: regular, color: WHITE })
  }
  await drawLogoInHeader(doc, page, headerLogoBytes, headerH, H, W)

  let y = H - 136
  for (let i = 0; i < entries.length; i++) {
    if (y < footerH + 26) break
    const pageNumber = i + 3 // cover + toc before content pages
    const label = sanitizeForPdf(entries[i], regular)
    const safe = label.length > 64 ? `${label.slice(0, 61)}...` : label
    page.drawCircle({ x: 20, y: y + 2, size: 7, color: GREEN, borderColor: GREEN, borderWidth: 1 })
    const badge = `${i + 1}`
    const badgeW = bold.widthOfTextAtSize(badge, 8)
    page.drawText(badge, { x: 20 - badgeW / 2, y: y - 1, size: 8, font: bold, color: WHITE })
    page.drawText(safe, { x: 32, y, size: 10, font: regular, color: SLATE })
    page.drawText(String(pageNumber), { x: W - 44, y, size: 10, font: bold, color: GREEN })
    page.drawRectangle({ x: 28, y: y - 6, width: W - 56, height: 0.5, color: rgb(0.886, 0.906, 0.941) })
    y -= 24
  }

  page.drawRectangle({ x: 0, y: 0, width: W, height: footerH, color: GREEN })
  page.drawText("Confidential — ACOB Internal Use Only", { x: 20, y: 14, size: 8, font: regular, color: WHITE })
}

async function addWeeklyReportContentPage(
  doc: PDFDocument,
  bold: any,
  regular: any,
  department: string,
  report: any,
  headerLogoBytes: Uint8Array | null,
  pageNumber: number
) {
  const page = doc.addPage([595, 842])
  const { width: W, height: H } = page.getSize()
  const footerH = 40
  const headerH = 52

  page.drawRectangle({ x: 0, y: H - headerH, width: W, height: headerH, color: DARK })
  page.drawRectangle({ x: 0, y: H - headerH - 4, width: W, height: 4, color: GREEN })
  page.drawText(sanitizeForPdf(department.toUpperCase(), bold), { x: 22, y: H - 32, size: 9, font: bold, color: WHITE })
  await drawLogoInHeader(doc, page, headerLogoBytes, headerH, H, W)

  const bodyTop = H - headerH - 8
  const bodyH = bodyTop - footerH
  const rowH = bodyH / 3
  const padX = 20
  const innerW = W - padX * 2
  const labelH = 22

  const sections = [
    {
      label: "WORK DONE",
      color: GREEN,
      text: sanitizeForPdf(autoNumber(report.work_done || "No data provided."), regular),
    },
    {
      label: "TASKS FOR NEW WEEK",
      color: BLUE,
      text: sanitizeForPdf(autoNumber(report.tasks_new_week || "No data provided."), regular),
    },
    {
      label: "CHALLENGES",
      color: RED,
      text: sanitizeForPdf(autoNumber(report.challenges || "No challenges reported."), regular),
    },
  ]

  const drawFittedSectionLines = (linesInput: string[], startX: number, startY: number, bottomLimit: number) => {
    const buildLinesWithIndent = (
      lines: string[],
      firstChars: number,
      continuationChars: number,
      continuationIndentPx: number
    ): Array<{ text: string; indent: number }> => {
      const out: Array<{ text: string; indent: number }> = []
      lines.forEach((raw) => {
        const line = (raw || "").trim()
        if (!line) {
          out.push({ text: "", indent: 0 })
          return
        }
        const numbered = line.match(/^(\d+\.)\s+(.*)$/)
        if (!numbered) {
          wrapText(line, firstChars).forEach((w) => out.push({ text: w, indent: 0 }))
          return
        }
        const prefix = `${numbered[1]} `
        const body = numbered[2] || ""
        const firstBodyLines = wrapText(body, Math.max(10, firstChars - prefix.length))
        if (!firstBodyLines.length) {
          out.push({ text: prefix.trimEnd(), indent: 0 })
          return
        }
        out.push({ text: `${prefix}${firstBodyLines[0]}`, indent: 0 })
        const remainder = firstBodyLines.slice(1).join(" ")
        if (remainder) {
          wrapText(remainder, continuationChars).forEach((w) => out.push({ text: w, indent: continuationIndentPx }))
        }
      })
      return out
    }

    const tryConfigs = [
      { chars: 92, size: 8, lineH: 12 },
      { chars: 100, size: 7.5, lineH: 11 },
      { chars: 110, size: 7, lineH: 10 },
      { chars: 120, size: 6.5, lineH: 9 },
      { chars: 130, size: 6, lineH: 8.5 },
    ]

    for (const cfg of tryConfigs) {
      const wrapped = buildLinesWithIndent(linesInput, cfg.chars, Math.max(10, cfg.chars - 6), 8)
      const availableHeight = startY - bottomLimit
      const maxLines = Math.max(1, Math.floor(availableHeight / cfg.lineH))
      if (wrapped.length <= maxLines) {
        let ty = startY
        for (const line of wrapped) {
          page.drawText(line.text, { x: startX + line.indent, y: ty, size: cfg.size, font: regular, color: SLATE })
          ty -= cfg.lineH
        }
        return
      }
    }

    // Last fallback: clipped + continuation hint.
    let ty = startY
    const wrapped = buildLinesWithIndent(linesInput, 130, 124, 8)
    const maxLines = Math.max(1, Math.floor((startY - bottomLimit) / 8.5) - 1)
    for (const line of wrapped.slice(0, maxLines)) {
      page.drawText(line.text, { x: startX + line.indent, y: ty, size: 6, font: regular, color: SLATE })
      ty -= 8.5
    }
    page.drawText("... continued", { x: startX, y: Math.max(bottomLimit + 1, ty), size: 6, font: bold, color: RED })
  }

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]
    const sectionTop = bodyTop - i * rowH

    page.drawRectangle({ x: padX, y: sectionTop - labelH, width: innerW, height: labelH, color: s.color })
    page.drawText(s.label, { x: padX + 6, y: sectionTop - labelH + 7, size: 8, font: bold, color: WHITE })

    const textStartY = sectionTop - labelH - 14
    const bottomLimit = sectionTop - rowH + 6
    drawFittedSectionLines(s.text.split("\n"), padX + 6, textStartY, bottomLimit)

    if (i < 2) {
      page.drawRectangle({ x: padX, y: sectionTop - rowH, width: innerW, height: 0.5, color: rgb(0.8, 0.85, 0.9) })
    }
  }

  page.drawRectangle({ x: 0, y: 0, width: W, height: footerH, color: GREEN })
  page.drawText("Confidential \u2014 ACOB Internal Use Only", { x: 20, y: 14, size: 8, font: regular, color: WHITE })
  const pn = String(pageNumber)
  const pnW = bold.widthOfTextAtSize(pn, 9)
  page.drawText(pn, { x: W / 2 - pnW / 2, y: 14, size: 9, font: bold, color: WHITE })
}

async function addActionTrackerPage(
  doc: PDFDocument,
  bold: any,
  regular: any,
  department: string,
  actions: any[],
  week: number,
  year: number,
  headerLogoBytes: Uint8Array | null,
  pageNumber: number
) {
  const page = doc.addPage([595, 842])
  const { width: W, height: H } = page.getSize()
  const footerH = 40
  const headerH = 52

  page.drawRectangle({ x: 0, y: H - headerH, width: W, height: headerH, color: DARK })
  page.drawRectangle({ x: 0, y: H - headerH - 4, width: W, height: 4, color: GREEN })
  page.drawText(sanitizeForPdf(department.toUpperCase(), bold), { x: 22, y: H - 32, size: 9, font: bold, color: WHITE })
  await drawLogoInHeader(doc, page, headerLogoBytes, headerH, H, W)

  const badgeW = 85,
    badgeH = 20
  page.drawRectangle({
    x: W - 20 - badgeW,
    y: H - headerH - 4 - badgeH - 8,
    width: badgeW,
    height: badgeH,
    color: GREEN,
  })
  page.drawText(`Week ${week}, ${year}`, {
    x: W - 20 - badgeW / 2 - 22,
    y: H - headerH - 4 - badgeH - 8 + 6,
    size: 8,
    font: bold,
    color: WHITE,
  })

  page.drawText("ACTION TRACKER", { x: 20, y: H - headerH - 4 - 30, size: 12, font: bold, color: DARK })
  page.drawRectangle({ x: 20, y: H - headerH - 4 - 36, width: W - 40, height: 1.5, color: GREEN })

  // Column headers: S/N | ACTION ITEM | STATUS
  const snX = 20
  const snW = 30
  const actionX = snX + snW
  const statusW = 100
  const statusX = W - 20 - statusW
  // Add a bit more vertical breathing room between title band and table header
  const headerY = H - headerH - 58
  page.drawRectangle({ x: 20, y: headerY - 4, width: W - 40, height: 20, color: GREEN })
  page.drawText("S/N", { x: snX + 6, y: headerY + 2, size: 8, font: bold, color: WHITE })
  page.drawText("ACTION ITEM", { x: actionX + 6, y: headerY + 2, size: 8, font: bold, color: WHITE })
  page.drawText("STATUS", { x: statusX + 6, y: headerY + 2, size: 8, font: bold, color: WHITE })

  const statusColors: Record<string, any> = {
    completed: rgb(0.086, 0.396, 0.204),
    in_progress: rgb(0.114, 0.306, 0.847),
    not_started: rgb(0.706, 0.325, 0.035),
    pending: rgb(0.392, 0.455, 0.545),
  }
  const statusLabels: Record<string, string> = {
    completed: "Completed",
    in_progress: "In Progress",
    not_started: "Not Started",
    pending: "Pending",
  }

  let rowTop = headerY - 20
  const minRowH = 20
  const lineH = 8
  const maxTitleLines = 3

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]
    const titleLinesRaw = wrapText(sanitizeForPdf(action.title || "", regular), 60)
    const titleLines = titleLinesRaw.slice(0, maxTitleLines)
    if (titleLinesRaw.length > maxTitleLines && titleLines.length > 0) {
      titleLines[titleLines.length - 1] = `${titleLines[titleLines.length - 1]}...`
    }
    const rowH = Math.max(minRowH, titleLines.length * lineH + 8)
    const rowBottom = rowTop - rowH
    if (rowBottom < footerH + 10) break

    if (i % 2 === 0) {
      page.drawRectangle({ x: 20, y: rowBottom, width: W - 40, height: rowH, color: LIGHT })
    }
    page.drawText(`${i + 1}`, { x: snX + 10, y: rowBottom + rowH - 12, size: 8, font: bold, color: SLATE })
    titleLines.forEach((line, lineIdx) => {
      page.drawText(line, {
        x: actionX + 6,
        y: rowBottom + rowH - 12 - lineIdx * lineH,
        size: 8,
        font: regular,
        color: SLATE,
      })
    })
    const sc = statusColors[action.status] || statusColors.pending
    const sl = statusLabels[action.status] || action.status
    const badgeY = rowBottom + (rowH - 14) / 2
    page.drawRectangle({ x: statusX + 4, y: badgeY, width: statusW - 8, height: 14, color: sc })
    page.drawText(sl, { x: statusX + 8, y: badgeY + 5, size: 7, font: bold, color: WHITE })
    page.drawRectangle({ x: 20, y: rowBottom, width: W - 40, height: 0.5, color: rgb(0.886, 0.906, 0.941) })
    rowTop = rowBottom
  }

  page.drawRectangle({ x: 0, y: 0, width: W, height: footerH, color: GREEN })
  page.drawText("Confidential \u2014 ACOB Internal Use Only", { x: 20, y: 14, size: 8, font: regular, color: WHITE })
  const pn = String(pageNumber)
  const pnW = bold.widthOfTextAtSize(pn, 9)
  page.drawText(pn, { x: W / 2 - pnW / 2, y: 14, size: 9, font: bold, color: WHITE })
}

async function buildWeeklyReportPDF(
  reports: any[],
  meetingWeek: number,
  meetingYear: number,
  coverLogoBytes: Uint8Array | null,
  headerLogoBytes: Uint8Array | null
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const regular = await doc.embedFont(StandardFonts.Helvetica)

  const sorted = [...reports].sort((a, b) => {
    const ia = DEPT_ORDER.indexOf(a.department)
    const ib = DEPT_ORDER.indexOf(b.department)
    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1
    return a.department.localeCompare(b.department)
  })

  await addCoverPage(doc, bold, regular, meetingWeek, meetingYear, "", "Weekly Report", coverLogoBytes)
  await addTOCPage(
    doc,
    bold,
    regular,
    `Weekly Report — Week ${meetingWeek}, ${meetingYear}`,
    sorted.map((r) => r.department),
    headerLogoBytes
  )

  for (let i = 0; i < sorted.length; i++) {
    await addWeeklyReportContentPage(doc, bold, regular, sorted[i].department, sorted[i], headerLogoBytes, i + 3)
  }

  return doc.save()
}

async function buildActionTrackerPDF(
  actions: any[],
  meetingWeek: number,
  meetingYear: number,
  coverLogoBytes: Uint8Array | null,
  headerLogoBytes: Uint8Array | null
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const regular = await doc.embedFont(StandardFonts.Helvetica)

  await addCoverPage(doc, bold, regular, meetingWeek, meetingYear, "Action Tracker", "Action Tracker", coverLogoBytes)

  const grouped: Record<string, any[]> = {}
  for (const a of actions) {
    if (!grouped[a.department]) grouped[a.department] = []
    grouped[a.department].push(a)
  }

  const depts = DEPT_ORDER.filter((d) => grouped[d])
  for (const d of Object.keys(grouped)) {
    if (!depts.includes(d)) depts.push(d)
  }

  await addTOCPage(doc, bold, regular, `Action Tracker — Week ${meetingWeek}, ${meetingYear}`, depts, headerLogoBytes)

  for (let i = 0; i < depts.length; i++) {
    await addActionTrackerPage(
      doc,
      bold,
      regular,
      depts[i],
      grouped[depts[i]],
      meetingWeek,
      meetingYear,
      headerLogoBytes,
      i + 3
    )
  }

  return doc.save()
}

function buildEmailHtml(meetingWeek: number, meetingYear: number, preparedByName: string): string {
  const meetingDate = getWeekMonday(meetingWeek, meetingYear)
  const nextMeetingDate = getNextMeetingDate(meetingWeek, meetingYear)
  const safePreparedBy = escapeHtml((preparedByName || "").trim() || "ACOB Team")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Report &amp; Action Tracker</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { margin: 0; padding: 0; background: #fff; font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; }
    .email-shell { max-width: 600px; margin: 0 auto; overflow: hidden; }
    .outer-header { background: #0f2d1f; padding: 20px 0; text-align: center; border-bottom: 3px solid #16a34a; }
    .wrapper { max-width: 600px; margin: 0 auto; background: #fff; padding: 32px 28px; }
    .week-badge { display: inline-block; background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; margin-bottom: 16px; }
    .title { font-size: 24px; font-weight: 700; color: #111827; margin-bottom: 14px; }
    .text { font-size: 15px; color: #374151; line-height: 1.6; margin: 0 0 18px 0; }
    .cta { text-align: center; margin-top: 32px; }
    .button { display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
    .footer { background: #0f2d1f; padding: 20px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 3px solid #16a34a; }
    .footer strong { color: #fff; }
    .footer-system { color: #16a34a; font-weight: 600; }
    .footer-note { color: #9ca3af; font-style: italic; }
  </style>
</head>
<body>
  <div class="email-shell">
  <div class="outer-header" style="background-color:#0f2d1f;">
    <img src="https://erp.acoblighting.com/images/acob-logo-dark.png" height="40" alt="ACOB Lighting">
  </div>
  <div class="wrapper">
    <span class="week-badge">Week ${meetingWeek} &bull; ${meetingYear}</span>
    <div class="title">Minutes of Meeting and Actionables</div>
    <p class="text">Dear All,</p>
    <p class="text">
      Please find attached the <strong>Minutes and Actionable of the General Meeting</strong> that held on <strong>${meetingDate}</strong>.
    </p>
    <p class="text">
      Kindly review and note any observations or questions you may have ahead of the next General Meeting on <strong>${nextMeetingDate}</strong>.
    </p>
    <p class="text">Thank you</p>
  </div>
  <div class="footer" style="background-color:#0f2d1f;">
    <strong>ACOB Lighting Technology Limited</strong><br>
    Prepared by ${safePreparedBy}<br>
    ACOB Admin &amp; HR Department<br>
    <span class="footer-system">Reports &amp; Meeting Management System</span>
    <br><br>
    <i class="footer-note">This is an automated system notification. Please do not reply directly to this email.</i>
  </div>
  </div>
</body>
</html>`
}

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return new Response("Unauthorized", { status: 401 })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const resend = new Resend(RESEND_API_KEY)

    let body: any = {}
    try {
      body = await req.json()
    } catch {
      /* cron sends no body */
    }

    const {
      testEmail,
      recipients: bodyRecipients,
      weeklyReportBase64,
      actionTrackerBase64,
      // NEW: meetingWeek is the week of the meeting (what shows on cover page)
      meetingWeek: bodyMeetingWeek,
      meetingYear: bodyMeetingYear,
      // LEGACY: forceWeek (kept for backwards compat with old callers)
      forceWeek,
      forceYear,
      week: bodyWeek,
      year: bodyYear,
      contentChoice,
      skipWeeklyReport: bodySkipWeeklyReport,
      skipActionTracker: bodySkipActionTracker,
      weeklyReportFilename,
      actionTrackerFilename,
      preparedByName,
    } = body

    const { week: currentWeek, year: currentYear } = getCurrentOfficeWeek()

    // ── Determine meeting week (the week everything is labelled as) ──────
    let meetingWeek: number
    let meetingYear: number

    if (bodyMeetingWeek) {
      meetingWeek = bodyMeetingWeek
      meetingYear = bodyMeetingYear || currentYear
    } else if (forceWeek) {
      // Legacy: use the week as-is (no offset)
      meetingWeek = forceWeek
      meetingYear = forceYear || currentYear
    } else if (bodyWeek) {
      // Legacy: use the week as-is (no offset)
      meetingWeek = bodyWeek
      meetingYear = bodyYear || currentYear
    } else {
      // Auto: current week
      meetingWeek = currentWeek
      meetingYear = currentYear
    }

    // ── Data weeks ──────────────────────────────────────────────────────
    // Everything uses the same meeting week — no previous-week offset
    const reportDataWeek = meetingWeek
    const reportDataYear = meetingYear
    const atWeek = meetingWeek
    const atYear = meetingYear

    console.log(
      `[digest] Meeting: W${meetingWeek}/${meetingYear} | ReportData: W${reportDataWeek}/${reportDataYear} | Tracker: W${atWeek}/${atYear}`
    )

    let includeWeeklyReport = !bodySkipWeeklyReport
    let includeActionTracker = !bodySkipActionTracker

    if (contentChoice === "weekly_report") includeActionTracker = false
    if (contentChoice === "action_tracker") includeWeeklyReport = false

    // If caller provides a specific attachment, include it by default.
    if (weeklyReportBase64) includeWeeklyReport = true
    if (actionTrackerBase64) includeActionTracker = true

    if (!includeWeeklyReport && !includeActionTracker) {
      throw new Error("No attachments selected")
    }

    let reportPdfBase64: string | undefined
    let trackerPdfBase64: string | undefined

    if (weeklyReportBase64) {
      console.log("[digest] Using client-provided weekly report PDF")
      reportPdfBase64 = weeklyReportBase64
    }

    if (actionTrackerBase64) {
      console.log("[digest] Using client-provided action tracker PDF")
      trackerPdfBase64 = actionTrackerBase64
    }

    if ((includeWeeklyReport && !reportPdfBase64) || (includeActionTracker && !trackerPdfBase64)) {
      console.log("[digest] Generating PDFs server-side")

      // Fetch reports from the PREVIOUS week (work done data)
      const { data: reports, error: reportsError } = await supabase
        .from("weekly_reports")
        .select("id, department, week_number, year, work_done, tasks_new_week, challenges, status")
        .eq("week_number", reportDataWeek)
        .eq("year", reportDataYear)
        .eq("status", "submitted")

      if (reportsError) throw reportsError

      if (!reports || reports.length === 0) {
        console.log(`[digest] No submitted reports for W${reportDataWeek}/${reportDataYear}. Skipping.`)
        return new Response(
          JSON.stringify({ skipped: true, reason: `No submitted reports for W${reportDataWeek}/${reportDataYear}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        )
      }

      // Fetch action items for the meeting week
      const { data: actions, error: actionsError } = await supabase
        .from("action_items")
        .select("id, title, department, status, week_number, year")
        .eq("week_number", atWeek)
        .eq("year", atYear)

      if (actionsError) throw actionsError

      // Fetch BOTH logos: light for cover page, dark for headers
      const [coverLogoBytes, headerLogoBytes] = await Promise.all([
        fetchLogoBytes(`${STORAGE_BASE}/acob-logo-light.png`),
        fetchLogoBytes(`${STORAGE_BASE}/acob-logo-dark.png`),
      ])

      console.log(`[digest] Generating PDFs: ${reports.length} reports, ${(actions || []).length} actions`)
      const [reportPdfBytes, trackerPdfBytes] = await Promise.all([
        includeWeeklyReport && !reportPdfBase64
          ? buildWeeklyReportPDF(reports, meetingWeek, meetingYear, coverLogoBytes, headerLogoBytes)
          : Promise.resolve<Uint8Array | null>(null),
        includeActionTracker && !trackerPdfBase64
          ? buildActionTrackerPDF(actions || [], meetingWeek, meetingYear, coverLogoBytes, headerLogoBytes)
          : Promise.resolve<Uint8Array | null>(null),
      ])

      const toBase64 = (bytes: Uint8Array): string => {
        let binary = ""
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        return btoa(binary)
      }

      if (reportPdfBytes) reportPdfBase64 = toBase64(reportPdfBytes)
      if (trackerPdfBytes) trackerPdfBase64 = toBase64(trackerPdfBytes)
    }

    const recipients =
      Array.isArray(bodyRecipients) && bodyRecipients.length > 0
        ? bodyRecipients
        : testEmail
          ? [testEmail]
          : ["i.chibuikem@org.acoblighting.com"]

    const meetingDate = getWeekMonday(meetingWeek, meetingYear)
    const subject = `Minutes of Meeting and Actionables - ${meetingDate}`
    const html = buildEmailHtml(meetingWeek, meetingYear, preparedByName || "ACOB Team")

    const attachments: { filename: string; content: string }[] = []
    if (includeWeeklyReport && reportPdfBase64) {
      attachments.push({
        filename: weeklyReportFilename || `ACOB_Weekly_Reports_W${meetingWeek}_${meetingYear}.pdf`,
        content: reportPdfBase64,
      })
    }
    if (includeActionTracker && trackerPdfBase64) {
      attachments.push({
        filename: actionTrackerFilename || `ACOB_Action_Tracker_W${meetingWeek}_${meetingYear}.pdf`,
        content: trackerPdfBase64,
      })
    }
    if (attachments.length === 0) throw new Error("No attachments to send")

    const results = []
    for (const to of recipients) {
      const { data, error } = await sendWithRetry(resend, {
        from: "ACOB Admin & HR <notifications@acoblighting.com>",
        to,
        subject,
        html,
        attachments,
      })
      if (error) {
        console.error(`[digest] Failed to send to ${to}:`, JSON.stringify(error))
        results.push({ to, success: false, error })
      } else {
        console.log(`[digest] Sent to ${to}. ID: ${data?.id}`)
        results.push({ to, success: true, emailId: data?.id })
      }
      await sleep(SEND_INTERVAL_MS)
    }

    return new Response(
      JSON.stringify({
        success: true,
        meetingWeek,
        meetingYear,
        reportDataWeek,
        reportDataYear,
        atWeek,
        atYear,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )
  } catch (err: any) {
    console.error("[send-weekly-digest] Error:", err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})
