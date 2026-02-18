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

// ─── Colours ──────────────────────────────────────────────────────────────────
const GREEN = rgb(0.102, 0.478, 0.29)
const DARK = rgb(0.059, 0.176, 0.122)
const WHITE = rgb(1, 1, 1)
const SLATE = rgb(0.2, 0.255, 0.333)
const MUTED = rgb(0.392, 0.455, 0.545)
const BLUE = rgb(0.114, 0.416, 0.588)
const RED = rgb(0.725, 0.11, 0.11)
const LIGHT = rgb(0.976, 0.984, 0.992)

// ─── ISO week helpers ─────────────────────────────────────────────────────────
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

// ─── Fetch logo bytes ─────────────────────────────────────────────────────────
async function fetchLogoBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return new Uint8Array(await res.arrayBuffer())
  } catch {
    return null
  }
}

// ─── Draw logo in page header (shared helper) ─────────────────────────────────
async function drawLogoInHeader(doc: PDFDocument, page: any, logoBytes: Uint8Array | null, headerH: number, H: number) {
  if (!logoBytes) return
  try {
    const img = await doc.embedPng(logoBytes)
    const dims = img.scaleToFit(100, 30)
    page.drawImage(img, {
      x: 16,
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
  logoBytes: Uint8Array | null
) {
  const page = doc.addPage([595, 842])
  const { width: W, height: H } = page.getSize()
  const mondayDate = getWeekMonday(week, year)

  // Dark header bar
  page.drawRectangle({ x: 0, y: H - 60, width: W, height: 60, color: DARK })
  page.drawRectangle({ x: 0, y: H - 66, width: W, height: 6, color: GREEN })

  await drawLogoInHeader(doc, page, logoBytes, 60, H)

  // Centre content
  page.drawRectangle({ x: 80, y: H / 2 + 20, width: W - 160, height: 2, color: GREEN })
  page.drawText("General Meeting", { x: W / 2 - 120, y: H / 2 + 40, size: 28, font: bold, color: DARK })
  page.drawText("Weekly Report", { x: W / 2 - 80, y: H / 2 + 8, size: 20, font: regular, color: GREEN })

  const pillW = 100,
    pillH = 24,
    pillX = W / 2 - 50,
    pillY = H / 2 - 30
  page.drawRectangle({ x: pillX, y: pillY, width: pillW, height: pillH, color: GREEN })
  page.drawText(`Week ${week}`, { x: pillX + 18, y: pillY + 7, size: 12, font: bold, color: WHITE })
  page.drawText(mondayDate, { x: W / 2 - 90, y: pillY - 22, size: 10, font: regular, color: MUTED })

  if (subtitle) {
    page.drawText(subtitle, { x: W / 2 - 60, y: pillY - 42, size: 10, font: regular, color: GREEN })
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

// ─── Weekly Report content page ───────────────────────────────────────────────
// Layout: 3 rows, 1 column — Work Done / Tasks for New Week / Challenges
async function addWeeklyReportContentPage(
  doc: PDFDocument,
  bold: any,
  regular: any,
  department: string,
  report: any,
  logoBytes: Uint8Array | null,
  nextDept?: string
) {
  const page = doc.addPage([595, 842])
  const { width: W, height: H } = page.getSize()
  const footerH = 40
  const headerH = 52

  // Header bar
  page.drawRectangle({ x: 0, y: H - headerH, width: W, height: headerH, color: DARK })
  await drawLogoInHeader(doc, page, logoBytes, headerH, H)
  page.drawText(department.toUpperCase(), { x: 120, y: H - 30, size: 9, font: bold, color: WHITE })
  page.drawRectangle({ x: 0, y: H - headerH - 4, width: W, height: 4, color: GREEN })

  // Body: 3 equal rows
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

    // Label bar
    page.drawRectangle({ x: padX, y: sectionTop - labelH, width: innerW, height: labelH, color: s.color })
    page.drawText(s.label, { x: padX + 6, y: sectionTop - labelH + 7, size: 8, font: bold, color: WHITE })

    // Content lines
    let ty = sectionTop - labelH - 14
    const bottomLimit = sectionTop - rowH + 6
    for (const rawLine of s.text.split("\n")) {
      for (const wrapped of wrapText(rawLine, 92)) {
        if (ty < bottomLimit) break
        page.drawText(wrapped, { x: padX + 6, y: ty, size: 8, font: regular, color: SLATE })
        ty -= 12
      }
    }

    // Row divider (not after last)
    if (i < 2) {
      page.drawRectangle({ x: padX, y: sectionTop - rowH, width: innerW, height: 0.5, color: rgb(0.8, 0.85, 0.9) })
    }
  }

  // Footer
  page.drawRectangle({ x: 0, y: 0, width: W, height: footerH, color: GREEN })
  page.drawText("Confidential \u2014 ACOB Internal Use Only", { x: 20, y: 14, size: 8, font: regular, color: WHITE })
  if (nextDept) {
    const label = `NEXT: ${nextDept}`
    const truncated = label.length > 30 ? label.slice(0, 27) + "..." : label
    page.drawText(truncated, { x: W - 170, y: 14, size: 8, font: bold, color: WHITE })
  }
}

// ─── Action Tracker content page ──────────────────────────────────────────────
async function addActionTrackerPage(
  doc: PDFDocument,
  bold: any,
  regular: any,
  department: string,
  actions: any[],
  week: number,
  year: number,
  logoBytes: Uint8Array | null,
  nextDept?: string
) {
  const page = doc.addPage([595, 842])
  const { width: W, height: H } = page.getSize()
  const footerH = 40
  const headerH = 52

  // Header bar
  page.drawRectangle({ x: 0, y: H - headerH, width: W, height: headerH, color: DARK })
  await drawLogoInHeader(doc, page, logoBytes, headerH, H)
  page.drawText(department.toUpperCase(), { x: 120, y: H - 30, size: 9, font: bold, color: WHITE })

  // Week badge in header
  page.drawRectangle({ x: W - 110, y: H - headerH + 14, width: 90, height: 20, color: GREEN })
  page.drawText(`Week ${week}, ${year}`, { x: W - 100, y: H - headerH + 21, size: 8, font: bold, color: WHITE })
  page.drawRectangle({ x: 0, y: H - headerH - 4, width: W, height: 4, color: GREEN })

  // Section title
  page.drawText("ACTION TRACKER", { x: 20, y: H - headerH - 22, size: 12, font: bold, color: DARK })
  page.drawRectangle({ x: 20, y: H - headerH - 28, width: W - 40, height: 1.5, color: GREEN })

  // Column headers
  const headerY = H - headerH - 50
  page.drawRectangle({ x: 20, y: headerY - 4, width: W - 40, height: 20, color: GREEN })
  page.drawText("ACTION ITEM", { x: 26, y: headerY + 2, size: 8, font: bold, color: WHITE })
  page.drawText("DEPARTMENT", { x: 260, y: headerY + 2, size: 8, font: bold, color: WHITE })
  page.drawText("STATUS", { x: 450, y: headerY + 2, size: 8, font: bold, color: WHITE })

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
    const title = action.title.length > 45 ? action.title.slice(0, 42) + "..." : action.title
    page.drawText(title, { x: 26, y: rowY - 4, size: 8, font: regular, color: SLATE })
    const dept = action.department.length > 22 ? action.department.slice(0, 20) + "..." : action.department
    page.drawText(dept, { x: 260, y: rowY - 4, size: 8, font: regular, color: SLATE })
    const sc = statusColors[action.status] || statusColors.pending
    const sl = statusLabels[action.status] || action.status
    page.drawRectangle({ x: 448, y: rowY - 10, width: 80, height: 14, color: sc })
    page.drawText(sl, { x: 452, y: rowY - 5, size: 7, font: bold, color: WHITE })
    page.drawRectangle({ x: 20, y: rowY - 13, width: W - 40, height: 0.5, color: rgb(0.886, 0.906, 0.941) })
    rowY -= rowH
  }

  // Footer
  page.drawRectangle({ x: 0, y: 0, width: W, height: footerH, color: GREEN })
  page.drawText("Confidential \u2014 ACOB Internal Use Only", { x: 20, y: 14, size: 8, font: regular, color: WHITE })
  if (nextDept) {
    const label = `NEXT: ${nextDept}`
    const truncated = label.length > 30 ? label.slice(0, 27) + "..." : label
    page.drawText(truncated, { x: W - 170, y: 14, size: 8, font: bold, color: WHITE })
  }
}

// ─── Build Weekly Report PDF ──────────────────────────────────────────────────
async function buildWeeklyReportPDF(
  reports: any[],
  week: number,
  year: number,
  logoBytes: Uint8Array | null
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

  await addCoverPage(doc, bold, regular, week, year, "", logoBytes)

  for (let i = 0; i < sorted.length; i++) {
    await addWeeklyReportContentPage(
      doc,
      bold,
      regular,
      sorted[i].department,
      sorted[i],
      logoBytes,
      sorted[i + 1]?.department
    )
  }

  return doc.save()
}

// ─── Build Action Tracker PDF ─────────────────────────────────────────────────
async function buildActionTrackerPDF(
  actions: any[],
  week: number,
  year: number,
  logoBytes: Uint8Array | null
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const regular = await doc.embedFont(StandardFonts.Helvetica)

  await addCoverPage(doc, bold, regular, week, year, "Action Tracker", logoBytes)

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
    await addActionTrackerPage(doc, bold, regular, depts[i], grouped[depts[i]], week, year, logoBytes, depts[i + 1])
  }

  return doc.save()
}

// ─── Email HTML ───────────────────────────────────────────────────────────────
function buildEmailHtml(
  reportWeek: number,
  reportYear: number,
  atWeek: number,
  atYear: number,
  currentWeek: number,
  currentYear: number
): string {
  // Meeting date = Monday of the CURRENT week (when email is sent / meeting happened)
  const meetingDate = getWeekMonday(currentWeek, currentYear)

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
    <span class="week-badge">Week ${currentWeek} &bull; ${currentYear}</span>
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
          <div class="attach-name">Weekly Report &mdash; Week ${reportWeek}, ${reportYear}</div>
          <div class="attach-desc">Departmental work done, tasks &amp; challenges</div>
        </div>
        <span class="attach-badge">PDF</span>
      </div>
      <div class="attach-card">
        <div class="attach-icon">&#9989;</div>
        <div class="attach-info">
          <div class="attach-name">Action Tracker &mdash; Week ${atWeek}, ${atYear}</div>
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
      forceWeek,
      forceYear,
      weeklyReportBase64, // pre-generated by client (jsPDF)
      actionTrackerBase64, // pre-generated by client (jsPDF)
      week: bodyWeek,
      year: bodyYear,
      actionTrackerWeek: bodyAtWeek,
      actionTrackerYear: bodyAtYear,
    } = body

    // Current week = the week we are IN (when email is sent / meeting happened)
    const { week: currentWeek, year: currentYear } = getCurrentISOWeek()

    // Report week = PREVIOUS week (what was done last week, reported this week)
    const { week: reportWeek, year: reportYear } = forceWeek
      ? { week: forceWeek, year: forceYear || currentYear }
      : bodyWeek
        ? { week: bodyWeek, year: bodyYear || currentYear }
        : getPreviousWeek(currentWeek, currentYear)

    // Action tracker week = CURRENT week
    const atWeek = bodyAtWeek ?? (forceWeek ? (forceWeek + 1 > 52 ? 1 : forceWeek + 1) : currentWeek)
    const atYear =
      bodyAtYear ??
      (forceWeek ? (forceWeek + 1 > 52 ? (forceYear || currentYear) + 1 : forceYear || currentYear) : currentYear)

    // The "current week" for filenames and email badge
    const displayWeek = bodyWeek ? bodyWeek + 1 : currentWeek
    const displayYear = displayWeek > 52 ? currentYear + 1 : currentYear

    console.log(
      `[digest] Current: W${currentWeek}/${currentYear} | Report: W${reportWeek}/${reportYear} | Tracker: W${atWeek}/${atYear} | Display: W${displayWeek}`
    )

    let reportPdfBase64: string
    let trackerPdfBase64: string

    if (weeklyReportBase64 && actionTrackerBase64) {
      // ── Use pre-generated PDFs from client (preferred — matches local export) ──
      console.log("[digest] Using client-generated PDFs")
      reportPdfBase64 = weeklyReportBase64
      trackerPdfBase64 = actionTrackerBase64
    } else {
      // ── Cron / fallback: generate PDFs server-side ────────────────────────────
      console.log("[digest] Generating PDFs server-side")

      // Fetch weekly reports
      const { data: reports, error: reportsError } = await supabase
        .from("weekly_reports")
        .select("id, department, week_number, year, work_done, tasks_new_week, challenges, status")
        .eq("week_number", reportWeek)
        .eq("year", reportYear)
        .eq("status", "submitted")

      if (reportsError) throw reportsError

      if (!reports || reports.length === 0) {
        console.log(`[digest] No submitted reports for W${reportWeek}/${reportYear}. Skipping.`)
        return new Response(
          JSON.stringify({ skipped: true, reason: `No submitted reports for W${reportWeek}/${reportYear}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        )
      }

      // Fetch action items
      const { data: actions, error: actionsError } = await supabase
        .from("action_items")
        .select("id, title, department, status, week_number, year")
        .eq("week_number", atWeek)
        .eq("year", atYear)

      if (actionsError) throw actionsError

      // pdf-lib (Deno) does not support WebP. Use PNG instead.
      const logoBytes = await fetchLogoBytes("https://erp.acoblighting.com/images/acob-logo-dark.png")

      console.log(`[digest] Generating PDFs: ${reports.length} reports, ${(actions || []).length} actions`)
      const [reportPdfBytes, trackerPdfBytes] = await Promise.all([
        buildWeeklyReportPDF(reports, reportWeek, reportYear, logoBytes),
        buildActionTrackerPDF(actions || [], atWeek, atYear, logoBytes),
      ])

      const toBase64 = (bytes: Uint8Array): string => {
        let binary = ""
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        return btoa(binary)
      }

      reportPdfBase64 = toBase64(reportPdfBytes)
      trackerPdfBase64 = toBase64(trackerPdfBytes)
    }

    // Recipients
    const recipients = testEmail ? [testEmail] : ["i.chibuikem@org.acoblighting.com"] // TODO: expand to all staff

    const subject = `General Meeting Minutes \u2014 Week ${displayWeek}, ${displayYear}`
    const html = buildEmailHtml(reportWeek, reportYear, atWeek, atYear, displayWeek, displayYear)

    const results = []
    for (const to of recipients) {
      const { data, error } = await resend.emails.send({
        from: "ACOB Admin & HR <no-reply@acoblighting.com>",
        to,
        subject,
        html,
        attachments: [
          { filename: `ACOB_Weekly_Reports_All_W${displayWeek}_${displayYear}.pdf`, content: reportPdfBase64 },
          { filename: `ACOB_Action_Tracker_W${atWeek}_${atYear}.pdf`, content: trackerPdfBase64 },
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
      JSON.stringify({ success: true, reportWeek, reportYear, atWeek, atYear, displayWeek, results }),
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
