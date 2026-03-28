import "server-only"

import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { jsPDF } from "jspdf"
import type { ActionItem } from "@/lib/export-utils"
import {
  getActionPointsDepartmentHeading,
  getCanonicalDepartmentOrder,
  normalizeDepartmentName,
} from "@/shared/departments"

const LOGO_FILE = join(process.cwd(), "public", "images", "acob-logo-light.png")
const VERDANA_REGULAR_FILE = "C:\\Windows\\Fonts\\verdana.ttf"
const VERDANA_BOLD_FILE = "C:\\Windows\\Fonts\\verdanab.ttf"
const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const TOP_MARGIN = 20
const BOTTOM_MARGIN = 20
const LEFT_MARGIN = 24
const RIGHT_MARGIN = 24
const CONTENT_WIDTH = PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN
const DEPARTMENT_ORDER = getCanonicalDepartmentOrder().filter((department) => department !== "Executive Management")

function formatActionPointsDate(week: number, year: number, meetingDate?: string) {
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

function groupActionItemsByDepartment(actions: ActionItem[]) {
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

async function getLogoDataUrl() {
  try {
    const logo = await readFile(LOGO_FILE)
    return `data:image/png;base64,${logo.toString("base64")}`
  } catch {
    return null
  }
}

async function registerVerdanaFonts(doc: jsPDF) {
  try {
    const [regularFont, boldFont] = await Promise.all([readFile(VERDANA_REGULAR_FILE), readFile(VERDANA_BOLD_FILE)])
    doc.addFileToVFS("verdana.ttf", regularFont.toString("base64"))
    doc.addFont("verdana.ttf", "Verdana-Regular", "normal")
    doc.addFileToVFS("verdanab.ttf", boldFont.toString("base64"))
    doc.addFont("verdanab.ttf", "Verdana-Bold", "normal")
    return true
  } catch {
    return false
  }
}

function drawFirstPageHeader(
  doc: jsPDF,
  meetingDateLabel: string,
  logoDataUrl: string | null,
  regularFontFamily: string,
  boldFontFamily: string
) {
  let y = TOP_MARGIN

  if (logoDataUrl) {
    const logoWidth = 44
    const logoHeight = 9.5
    const logoX = (PAGE_WIDTH - logoWidth) / 2
    doc.addImage(logoDataUrl, "PNG", logoX, y, logoWidth, logoHeight)
    y += logoHeight + 7
  }

  doc.setFont(boldFontFamily, "normal")
  doc.setFontSize(12)
  doc.text("ACTION POINTS", PAGE_WIDTH / 2, y, { align: "center" })
  y += 8

  doc.setFont(boldFontFamily, "normal")
  doc.setFontSize(12)
  doc.text(`Date: ${meetingDateLabel}`, LEFT_MARGIN, y)

  return y + 10
}

function resetContinuationPage(doc: jsPDF) {
  doc.addPage()
  return TOP_MARGIN
}

export async function generateActionPointsPdfBuffer(
  actions: ActionItem[],
  week: number,
  year: number,
  meetingDate?: string
): Promise<Uint8Array> {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const meetingDateLabel = formatActionPointsDate(week, year, meetingDate)
  const [logoDataUrl, hasVerdana] = await Promise.all([getLogoDataUrl(), registerVerdanaFonts(doc)])
  const regularFontFamily = hasVerdana ? "Verdana-Regular" : "times"
  const boldFontFamily = hasVerdana ? "Verdana-Bold" : "times"
  const { grouped, departments } = groupActionItemsByDepartment(actions)

  let y = drawFirstPageHeader(doc, meetingDateLabel, logoDataUrl, regularFontFamily, boldFontFamily)

  const ensureSpace = (requiredHeight: number) => {
    if (y + requiredHeight <= PAGE_HEIGHT - BOTTOM_MARGIN) return
    y = resetContinuationPage(doc)
  }

  departments.forEach((department, departmentIndex) => {
    const departmentActions = grouped[department] || []
    const departmentHeading = `${departmentIndex + 1}. ${getActionPointsDepartmentHeading(department)}`

    ensureSpace(12)
    doc.setFont(boldFontFamily, "normal")
    doc.setFontSize(12)
    doc.text(departmentHeading, LEFT_MARGIN, y)
    y += 7

    departmentActions.forEach((action) => {
      const bulletLabel = "\u2022"
      const bulletWidth = doc.getTextWidth(`${bulletLabel} `)
      const lineWidth = CONTENT_WIDTH - bulletWidth - 2
      const lines = doc.splitTextToSize(action.title || "", lineWidth)
      const rowHeight = Math.max(6.2, lines.length * 5.1)

      ensureSpace(rowHeight + 1.5)

      doc.setFont(regularFontFamily, "normal")
      doc.setFontSize(11)
      doc.text(bulletLabel, LEFT_MARGIN + 2, y)
      doc.text(lines, LEFT_MARGIN + bulletWidth + 4, y)
      y += rowHeight
    })

    y += 4
  })

  return new Uint8Array(doc.output("arraybuffer"))
}
