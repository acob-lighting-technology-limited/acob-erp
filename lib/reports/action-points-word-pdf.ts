import "server-only"

import { execFile } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import type { ActionItem } from "@/lib/export-utils"
import { generateActionPointsDocxBuffer } from "@/lib/reports/action-points-template"
import {
  getActionPointsDepartmentHeading,
  getCanonicalDepartmentOrder,
  normalizeDepartmentName,
} from "@/shared/departments"

const execFileAsync = promisify(execFile)
const WORD_PDF_FORMAT = 17
const PAGE_SIZE: [number, number] = [595, 842]
const PAGE_MARGIN_X = 54
const PAGE_MARGIN_TOP = 70
const PAGE_MARGIN_BOTTOM = 60
const LINE_GAP = 16
const BODY_FONT_SIZE = 11
const HEADING_FONT_SIZE = 12
const TITLE_FONT_SIZE = 14
const DATE_FONT_SIZE = 12
const TEXT_COLOR = rgb(0.16, 0.16, 0.16)
const LOGO_FILE = join(process.cwd(), "public", "images", "acob-logo-light.png")
const DEPARTMENT_ORDER = getCanonicalDepartmentOrder().filter((department) => department !== "Executive Management")

const encodePowerShell = (script: string) => Buffer.from(script, "utf16le").toString("base64")

const escapePowerShellPath = (value: string) => value.replace(/'/g, "''")

const wrapText = (text: string, maxWidth: number, font: PDFFontLike, fontSize: number) => {
  const words = String(text || "")
    .split(/\s+/)
    .filter(Boolean)
  const lines: string[] = []
  let currentLine = ""

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      currentLine = candidate
      continue
    }

    if (currentLine) lines.push(currentLine)
    currentLine = word
  }

  if (currentLine) lines.push(currentLine)
  return lines.length > 0 ? lines : [""]
}

type PDFFontLike = {
  widthOfTextAtSize: (text: string, size: number) => number
}

const formatActionPointsDate = (week: number, year: number, meetingDate?: string) => {
  if (meetingDate) {
    const parsed = new Date(`${meetingDate}T00:00:00`)
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed)
    }
  }

  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7))
  while (simple.getUTCDay() !== 1) simple.setUTCDate(simple.getUTCDate() - 1)
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(simple)
}

const groupActionItemsByDepartment = (actions: ActionItem[]) => {
  const grouped: Record<string, ActionItem[]> = {}

  actions.forEach((action) => {
    const department = normalizeDepartmentName(action.department)
    if (!grouped[department]) grouped[department] = []
    grouped[department].push({ ...action, department })
  })

  const departments = DEPARTMENT_ORDER.filter((department) => grouped[department])
  Object.keys(grouped).forEach((department) => {
    if (!departments.includes(department)) departments.push(department)
  })

  return { grouped, departments }
}

async function generateHostedSafePdf(actions: ActionItem[], week: number, year: number, meetingDate?: string) {
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.TimesRoman)
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold)
  const { grouped, departments } = groupActionItemsByDepartment(actions)
  const [pageWidth, pageHeight] = PAGE_SIZE
  const contentWidth = pageWidth - PAGE_MARGIN_X * 2
  const bulletIndent = 14
  const textWidth = contentWidth - bulletIndent

  let page = pdf.addPage(PAGE_SIZE)
  let cursorY = pageHeight - PAGE_MARGIN_TOP

  try {
    const logoBytes = await readFile(LOGO_FILE)
    const logo = await pdf.embedPng(logoBytes)
    const scaled = logo.scaleToFit(125, 26)
    page.drawImage(logo, {
      x: pageWidth / 2 - scaled.width / 2,
      y: cursorY - scaled.height,
      width: scaled.width,
      height: scaled.height,
    })
    cursorY -= scaled.height + 18
  } catch {
    // Skip logo when unavailable.
  }

  page.drawText("ACTION POINTS", {
    x: pageWidth / 2 - bold.widthOfTextAtSize("ACTION POINTS", TITLE_FONT_SIZE) / 2,
    y: cursorY,
    size: TITLE_FONT_SIZE,
    font: bold,
    color: TEXT_COLOR,
  })
  cursorY -= 24

  page.drawText(`Date: ${formatActionPointsDate(week, year, meetingDate)}`, {
    x: PAGE_MARGIN_X,
    y: cursorY,
    size: DATE_FONT_SIZE,
    font: bold,
    color: TEXT_COLOR,
  })
  cursorY -= 26

  const ensureSpace = (requiredHeight: number) => {
    if (cursorY - requiredHeight >= PAGE_MARGIN_BOTTOM) return
    page = pdf.addPage(PAGE_SIZE)
    cursorY = pageHeight - PAGE_MARGIN_TOP
  }

  for (let departmentIndex = 0; departmentIndex < departments.length; departmentIndex += 1) {
    const department = departments[departmentIndex]
    const heading = `${departmentIndex + 1}. ${getActionPointsDepartmentHeading(department)}`
    ensureSpace(24)
    page.drawText(heading, {
      x: PAGE_MARGIN_X,
      y: cursorY,
      size: HEADING_FONT_SIZE,
      font: bold,
      color: TEXT_COLOR,
    })
    cursorY -= 22

    for (const action of grouped[department] || []) {
      const sanitizedTitle = String(action.title || "")
        .replace(/[\f\v]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
      const lines = wrapText(sanitizedTitle, textWidth, regular, BODY_FONT_SIZE)
      const requiredHeight = Math.max(LINE_GAP * lines.length, LINE_GAP) + 6
      ensureSpace(requiredHeight)

      page.drawText("•", {
        x: PAGE_MARGIN_X + 2,
        y: cursorY,
        size: BODY_FONT_SIZE,
        font: regular,
        color: TEXT_COLOR,
      })

      lines.forEach((line, index) => {
        page.drawText(line, {
          x: PAGE_MARGIN_X + bulletIndent,
          y: cursorY - index * LINE_GAP,
          size: BODY_FONT_SIZE,
          font: regular,
          color: TEXT_COLOR,
        })
      })

      cursorY -= requiredHeight
    }

    cursorY -= 8
  }

  return await pdf.save()
}

async function convertDocxFileToPdf(docxPath: string, pdfPath: string) {
  if (process.platform !== "win32") {
    throw new Error("Action Points PDF export requires Windows with Microsoft Word installed")
  }

  const psScript = `
$ErrorActionPreference = 'Stop'
$word = $null
$document = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $document = $word.Documents.Open('${escapePowerShellPath(docxPath)}')
  $document.SaveAs('${escapePowerShellPath(pdfPath)}', ${WORD_PDF_FORMAT})
}
finally {
  if ($document -ne $null) { $document.Close([ref]$false) }
  if ($word -ne $null) { $word.Quit() }
}
`.trim()

  await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encodePowerShell(psScript)],
    { timeout: 120000, windowsHide: true }
  )
}

export async function generateActionPointsPdfFromDocxBuffer(
  actions: ActionItem[],
  week: number,
  year: number,
  meetingDate?: string
) {
  const docxBuffer = await generateActionPointsDocxBuffer(actions, week, year, meetingDate)

  if (process.platform !== "win32") {
    return await generateHostedSafePdf(actions, week, year, meetingDate)
  }

  const workingDir = await mkdtemp(join(tmpdir(), "acob-action-points-"))
  const docxPath = join(workingDir, `action-points-w${week}-${year}.docx`)
  const pdfPath = join(workingDir, `action-points-w${week}-${year}.pdf`)

  try {
    await writeFile(docxPath, Buffer.from(docxBuffer))
    try {
      await convertDocxFileToPdf(docxPath, pdfPath)
    } catch {
      return await generateHostedSafePdf(actions, week, year, meetingDate)
    }
    return new Uint8Array(await readFile(pdfPath))
  } finally {
    await rm(workingDir, { recursive: true, force: true })
  }
}
