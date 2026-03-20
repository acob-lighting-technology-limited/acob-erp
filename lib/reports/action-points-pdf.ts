import { jsPDF } from "jspdf"
import type { ActionItem } from "@/lib/export-utils"

const PDF_GREEN: [number, number, number] = [26, 122, 74]
const PDF_WHITE: [number, number, number] = [255, 255, 255]
const PDF_DARK: [number, number, number] = [15, 23, 42]
const PDF_MUTED: [number, number, number] = [100, 116, 139]
const PDF_SLATE: [number, number, number] = [51, 65, 85]

const DEPARTMENT_ORDER = [
  "Accounts",
  "Business, Growth and Innovation",
  "IT and Communications",
  "Admin & HR",
  "Legal, Regulatory and Compliance",
  "Operations",
  "Project",
  "Technical",
]

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

function getActionPointsDepartmentHeading(department: string) {
  const normalized = department.trim().toLowerCase()
  if (normalized === "accounts") return "ACCOUNTS DEPARTMENT"
  if (normalized === "admin & hr") return "ADMIN & HR"
  if (normalized === "business, growth and innovation") return "BUSINESS, GROWTH AND INNOVATION"
  if (normalized === "it and communications") return "IT & COMMUNICATIONS DEPARTMENT"
  if (normalized === "operations") return "OPERATIONS DEPARTMENT"
  if (normalized === "project") return "PROJECT DEPARTMENT"
  if (normalized === "technical") return "TECHNICAL DEPARTMENT"
  if (normalized === "legal, regulatory and compliance") return "LEGAL, REGULATORY AND COMPLIANCE DEPARTMENT"
  return `${department.toUpperCase()} DEPARTMENT`
}

function groupActionItemsByDepartment(actions: ActionItem[]) {
  const grouped: Record<string, ActionItem[]> = {}
  actions.forEach((action) => {
    if (!grouped[action.department]) grouped[action.department] = []
    grouped[action.department].push(action)
  })

  const departments = DEPARTMENT_ORDER.filter((department) => grouped[department])
  Object.keys(grouped).forEach((department) => {
    if (!departments.includes(department)) departments.push(department)
  })

  return { grouped, departments }
}

export function generateActionPointsPdfBuffer(
  actions: ActionItem[],
  week: number,
  year: number,
  meetingDate?: string
): Uint8Array {
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

  departments.forEach((department, departmentIndex) => {
    const departmentHeading = `${departmentIndex + 1}. ${getActionPointsDepartmentHeading(department)}`
    const departmentActions = grouped[department] || []

    if (y > bottomLimit - 12) startPage(false)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.setTextColor(...PDF_DARK)
    doc.text(departmentHeading, left, y)
    y += 8

    departmentActions.forEach((action) => {
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
  return new Uint8Array(doc.output("arraybuffer"))
}
