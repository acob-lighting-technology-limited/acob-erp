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

function getCurrentISOWeek(): { week: number; year: number } {
  const now = new Date()
  const jan4 = new Date(now.getFullYear(), 0, 4)
  const dayOfWeek = jan4.getDay() || 7
  const week1Monday = new Date(jan4)
  week1Monday.setDate(jan4.getDate() - (dayOfWeek - 1))
  const diff = now.getTime() - week1Monday.getTime()
  const week = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1
  return { week, year: now.getFullYear() }
}

function getPreviousWeek(week: number, year: number): { week: number; year: number } {
  if (week === 1) return { week: 52, year: year - 1 }
  return { week: week - 1, year }
}

function getWeekMonday(week: number, year: number): string {
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = jan4.getDay() || 7
  const week1Monday = new Date(jan4)
  week1Monday.setDate(jan4.getDate() - (dayOfWeek - 1))
  const monday = new Date(week1Monday)
  monday.setDate(week1Monday.getDate() + (week - 1) * 7)
  const day = monday.getDate()
  const suffix = [1, 21, 31].includes(day) ? "st" : [2, 22].includes(day) ? "nd" : [3, 23].includes(day) ? "rd" : "th"
  const month = monday.toLocaleString("en-GB", { month: "long" })
  return `${day}${suffix} ${month} ${monday.getFullYear()}`
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
  page.drawText(gmText, { x: W / 2 - gmWidth / 2, y: H / 2 + 30, size: 28, font: bold, color: DARK })

  const wrText = "Weekly Report"
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

async function addWeeklyReportContentPage(
  doc: PDFDocument,
  bold: any,
  regular: any,
  department: string,
  report: any,
  headerLogoBytes: Uint8Array | null,
  nextDept?: string
) {
  const page = doc.addPage([595, 842])
  const { width: W, height: H } = page.getSize()
  const footerH = 40
  const headerH = 52

  page.drawRectangle({ x: 0, y: H - headerH, width: W, height: headerH, color: DARK })
  page.drawRectangle({ x: 0, y: H - headerH - 4, width: W, height: 4, color: GREEN })
  page.drawText(department.toUpperCase(), { x: 22, y: H - 32, size: 9, font: bold, color: WHITE })
  await drawLogoInHeader(doc, page, headerLogoBytes, headerH, H, W)

  const bodyTop = H - headerH - 8
  const bodyH = bodyTop - footerH
  const rowH = bodyH / 3
  const padX = 20
  const innerW = W - padX * 2
  const labelH = 22

  const sections = [
    { label: "WORK DONE", color: GREEN, text: autoNumber(report.work_done || "No data provided.") },
    { label: "TASKS FOR NEW WEEK", color: BLUE, text: autoNumber(report.tasks_new_week || "No data provided.") },
    { label: "CHALLENGES", color: RED, text: autoNumber(report.challenges || "No challenges reported.") },
  ]

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]
    const sectionTop = bodyTop - i * rowH

    page.drawRectangle({ x: padX, y: sectionTop - labelH, width: innerW, height: labelH, color: s.color })
    page.drawText(s.label, { x: padX + 6, y: sectionTop - labelH + 7, size: 8, font: bold, color: WHITE })

    let ty = sectionTop - labelH - 14
    const bottomLimit = sectionTop - rowH + 6
    for (const rawLine of s.text.split("\n")) {
      for (const wrapped of wrapText(rawLine, 92)) {
        if (ty < bottomLimit) break
        page.drawText(wrapped, { x: padX + 6, y: ty, size: 8, font: regular, color: SLATE })
        ty -= 12
      }
    }

    if (i < 2) {
      page.drawRectangle({ x: padX, y: sectionTop - rowH, width: innerW, height: 0.5, color: rgb(0.8, 0.85, 0.9) })
    }
  }

  page.drawRectangle({ x: 0, y: 0, width: W, height: footerH, color: GREEN })
  page.drawText("Confidential \u2014 ACOB Internal Use Only", { x: 20, y: 14, size: 8, font: regular, color: WHITE })
  if (nextDept) {
    const label = `NEXT: ${nextDept}`
    const truncated = label.length > 30 ? label.slice(0, 27) + "..." : label
    page.drawText(truncated, { x: W - 170, y: 14, size: 8, font: bold, color: WHITE })
  }
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
  nextDept?: string
) {
  const page = doc.addPage([595, 842])
  const { width: W, height: H } = page.getSize()
  const footerH = 40
  const headerH = 52

  page.drawRectangle({ x: 0, y: H - headerH, width: W, height: headerH, color: DARK })
  page.drawRectangle({ x: 0, y: H - headerH - 4, width: W, height: 4, color: GREEN })
  page.drawText(department.toUpperCase(), { x: 22, y: H - 32, size: 9, font: bold, color: WHITE })
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
  const headerY = H - headerH - 50
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

  let rowY = headerY - 18
  const rowH = 20

  for (let i = 0; i < actions.length; i++) {
    if (rowY < footerH + 10) break
    const action = actions[i]
    if (i % 2 === 0) {
      page.drawRectangle({ x: 20, y: rowY - 12, width: W - 40, height: rowH, color: LIGHT })
    }
    page.drawText(`${i + 1}`, { x: snX + 10, y: rowY - 4, size: 8, font: bold, color: SLATE })
    const titleLines = wrapText(action.title, 60)
    page.drawText(titleLines[0], { x: actionX + 6, y: rowY - 4, size: 8, font: regular, color: SLATE })
    const sc = statusColors[action.status] || statusColors.pending
    const sl = statusLabels[action.status] || action.status
    page.drawRectangle({ x: statusX + 4, y: rowY - 10, width: statusW - 8, height: 14, color: sc })
    page.drawText(sl, { x: statusX + 8, y: rowY - 5, size: 7, font: bold, color: WHITE })
    page.drawRectangle({ x: 20, y: rowY - 13, width: W - 40, height: 0.5, color: rgb(0.886, 0.906, 0.941) })
    rowY -= rowH
  }

  page.drawRectangle({ x: 0, y: 0, width: W, height: footerH, color: GREEN })
  page.drawText("Confidential \u2014 ACOB Internal Use Only", { x: 20, y: 14, size: 8, font: regular, color: WHITE })
  if (nextDept) {
    const label = `NEXT: ${nextDept}`
    const truncated = label.length > 30 ? label.slice(0, 27) + "..." : label
    page.drawText(truncated, { x: W - 170, y: 14, size: 8, font: bold, color: WHITE })
  }
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

  await addCoverPage(doc, bold, regular, meetingWeek, meetingYear, "", coverLogoBytes)

  for (let i = 0; i < sorted.length; i++) {
    await addWeeklyReportContentPage(
      doc,
      bold,
      regular,
      sorted[i].department,
      sorted[i],
      headerLogoBytes,
      sorted[i + 1]?.department
    )
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

  await addCoverPage(doc, bold, regular, meetingWeek, meetingYear, "Action Tracker", coverLogoBytes)

  const grouped: Record<string, any[]> = {}
  for (const a of actions) {
    if (!grouped[a.department]) grouped[a.department] = []
    grouped[a.department].push(a)
  }

  const depts = DEPT_ORDER.filter((d) => grouped[d])
  for (const d of Object.keys(grouped)) {
    if (!depts.includes(d)) depts.push(d)
  }

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
      depts[i + 1]
    )
  }

  return doc.save()
}

function buildEmailHtml(
  meetingWeek: number,
  meetingYear: number,
  reportDataWeek: number,
  reportDataYear: number
): string {
  const meetingDate = getWeekMonday(meetingWeek, meetingYear)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Report &amp; Action Tracker</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { margin: 0; padding: 0; background: #fff; font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; }
    .outer-header { background: #000; width: 100%; padding: 20px 0; text-align: center; border-bottom: 3px solid #16a34a; }
    .wrapper { max-width: 600px; margin: 0 auto; background: #fff; padding: 32px 28px; }
    .week-badge { display: inline-block; background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; margin-bottom: 16px; }
    .title { font-size: 24px; font-weight: 700; color: #111827; margin-bottom: 14px; }
    .text { font-size: 15px; color: #374151; line-height: 1.6; margin: 0 0 18px 0; }
    .attachments { margin: 24px 0; display: flex; flex-direction: column; gap: 12px; }
    .attach-card { display: flex; align-items: center; gap: 14px; background: #f9fafb; border: 1px solid #d1d5db; padding: 14px 18px; }
    .attach-icon { width: 40px; height: 40px; background: #000; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 18px; border: 1px solid #16a34a; }
    .attach-info { flex: 1; }
    .attach-name { font-size: 14px; font-weight: 700; color: #111827; }
    .attach-desc { font-size: 12px; color: #6b7280; margin-top: 2px; }
    .attach-badge { font-size: 10px; font-weight: 700; background: #000; color: #16a34a; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; border: 1px solid #16a34a; }
    .cta { text-align: center; margin-top: 32px; }
    .button { display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
    .support { text-align: center; font-size: 14px; color: #4b5563; margin-top: 24px; line-height: 1.5; }
    .support a { color: #16a34a; font-weight: 600; text-decoration: none; }
    .footer { background: #000; padding: 20px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 3px solid #16a34a; }
    .footer strong { color: #fff; }
    .footer-system { color: #16a34a; font-weight: 600; }
    .footer-note { color: #9ca3af; font-style: italic; }
  </style>
</head>
<body>
  <div class="outer-header">
    <img src="https://erp.acoblighting.com/images/acob-logo-dark.png" height="40" alt="ACOB Lighting">
  </div>
  <div class="wrapper">
    <span class="week-badge">Week ${meetingWeek} &bull; ${meetingYear}</span>
    <div class="title">General Meeting Minutes &amp; Action Tracker</div>
    <p class="text">Dear All,</p>
    <p class="text">
      Please find attached the <strong>Weekly Report and Actionable Items</strong>
      for the general meeting which held on <strong>Monday, ${meetingDate}</strong>.
    </p>
    <p class="text">
      Kindly review and note any observations or questions you may have ahead of the next General Meeting.
    </p>
    <p class="text">Thank you</p>
    <div class="attachments">
      <div class="attach-card">
        <div class="attach-icon">&#128196;</div>
        <div class="attach-info">
          <div class="attach-name">Weekly Report &mdash; Week ${meetingWeek}, ${meetingYear}</div>
          <div class="attach-desc">Departmental work done, tasks &amp; challenges</div>
        </div>
        <span class="attach-badge">PDF</span>
      </div>
      <div class="attach-card">
        <div class="attach-icon">&#9989;</div>
        <div class="attach-info">
          <div class="attach-name">Action Tracker &mdash; Week ${meetingWeek}, ${meetingYear}</div>
          <div class="attach-desc">Upcoming departmental action items &amp; completion status</div>
        </div>
        <span class="attach-badge">PDF</span>
      </div>
    </div>
    <div class="cta">
      <a href="https://erp.acoblighting.com/portal/reports/weekly-reports" class="button">View Reports Portal</a>
    </div>
    <div class="support">
      If you have any questions, please contact<br>
      <a href="mailto:ict@acoblighting.com">ict@acoblighting.com</a>
    </div>
  </div>
  <div class="footer">
    <strong>ACOB Lighting Technology Limited</strong><br>
    ACOB Admin &amp; HR Department<br>
    <span class="footer-system">Reports &amp; Meeting Management System</span>
    <br><br>
    <i class="footer-note">This is an automated system notification. Please do not reply directly to this email.</i>
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
      actionTrackerWeek: bodyAtWeek,
      actionTrackerYear: bodyAtYear,
      contentChoice,
    } = body

    const { week: currentWeek, year: currentYear } = getCurrentISOWeek()

    // ── Determine meeting week (the week everything is labelled as) ──────
    let meetingWeek: number
    let meetingYear: number

    if (bodyMeetingWeek) {
      // New unified approach: meetingWeek is the meeting week directly
      meetingWeek = bodyMeetingWeek
      meetingYear = bodyMeetingYear || currentYear
    } else if (forceWeek) {
      // Legacy: forceWeek was the report-data week, meeting week = forceWeek + 1
      meetingWeek = forceWeek + 1 > 52 ? 1 : forceWeek + 1
      meetingYear = forceWeek + 1 > 52 ? (forceYear || currentYear) + 1 : forceYear || currentYear
    } else if (bodyWeek) {
      // Legacy: bodyWeek was report-data week
      meetingWeek = bodyWeek + 1 > 52 ? 1 : bodyWeek + 1
      meetingYear = bodyWeek + 1 > 52 ? (bodyYear || currentYear) + 1 : bodyYear || currentYear
    } else {
      // Auto: current week IS the meeting week
      meetingWeek = currentWeek
      meetingYear = currentYear
    }

    // ── Data weeks ──────────────────────────────────────────────────────
    // Reports data = previous week (week - 1), action tracker = meeting week
    const { week: reportDataWeek, year: reportDataYear } = getPreviousWeek(meetingWeek, meetingYear)
    const atWeek = bodyAtWeek ?? meetingWeek
    const atYear = bodyAtYear ?? meetingYear

    console.log(
      `[digest] Meeting: W${meetingWeek}/${meetingYear} | ReportData: W${reportDataWeek}/${reportDataYear} | Tracker: W${atWeek}/${atYear}`
    )

    let reportPdfBase64: string
    let trackerPdfBase64: string

    if (weeklyReportBase64 && actionTrackerBase64) {
      console.log("[digest] Using client-generated PDFs")
      reportPdfBase64 = weeklyReportBase64
      trackerPdfBase64 = actionTrackerBase64
    } else {
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
        buildWeeklyReportPDF(reports, meetingWeek, meetingYear, coverLogoBytes, headerLogoBytes),
        buildActionTrackerPDF(actions || [], meetingWeek, meetingYear, coverLogoBytes, headerLogoBytes),
      ])

      const toBase64 = (bytes: Uint8Array): string => {
        let binary = ""
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        return btoa(binary)
      }

      reportPdfBase64 = toBase64(reportPdfBytes)
      trackerPdfBase64 = toBase64(trackerPdfBytes)
    }

    const recipients =
      Array.isArray(bodyRecipients) && bodyRecipients.length > 0
        ? bodyRecipients
        : testEmail
          ? [testEmail]
          : ["i.chibuikem@org.acoblighting.com"]

    const subject = `General Meeting Minutes \u2014 Week ${meetingWeek}, ${meetingYear}`
    const html = buildEmailHtml(meetingWeek, meetingYear, reportDataWeek, reportDataYear)

    const results = []
    for (const to of recipients) {
      const { data, error } = await resend.emails.send({
        from: "ACOB Admin & HR <no-reply@acoblighting.com>",
        to,
        subject,
        html,
        attachments: [
          { filename: `ACOB_Weekly_Reports_All_W${meetingWeek}_${meetingYear}.pdf`, content: reportPdfBase64 },
          { filename: `ACOB_Action_Tracker_W${meetingWeek}_${meetingYear}.pdf`, content: trackerPdfBase64 },
        ],
      })
      if (error) {
        console.error(`[digest] Failed to send to ${to}:`, JSON.stringify(error))
        results.push({ to, success: false, error })
      } else {
        console.log(`[digest] Sent to ${to}. ID: ${data?.id}`)
        results.push({ to, success: true, emailId: data?.id })
      }
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
