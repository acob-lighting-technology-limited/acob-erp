/** Weekly report and action-point Excel exports. Split out of lib/export-utils.ts (audit 5.10). */
import { saveAs } from "file-saver"
import { getDepartmentAliases, normalizeDepartmentName } from "@/shared/departments"

import {
  WeeklyReport,
  inFlightActionPointFileExports,
  buildWeeklyReportFilename,
  buildActionPointFilename,
  sortReportsByDepartment,
  autoNumberLines,
  ActionItem,
  formatStatusLabel,
} from "./shared"

export const exportActionPointToXLSX = async (
  actions: ActionItem[],
  week: number,
  year: number,
  department?: string,
  meetingDate?: string
) => {
  const exportKey = ["xlsx", week, year, meetingDate || "", department || "all", actions.length].join(":")
  if (inFlightActionPointFileExports.has(exportKey)) return
  inFlightActionPointFileExports.add(exportKey)

  try {
    const XLSX = await import("@e965/xlsx")
    const filteredActions = department
      ? actions.filter((item) => getDepartmentAliases(department).includes(normalizeDepartmentName(item.department)))
      : actions

    const rows = filteredActions.map((item, index) => ({
      "S/N": index + 1,
      Department: normalizeDepartmentName(item.department),
      "Action Item": item.title,
      Description: item.description || "",
      Status: formatStatusLabel(item.status),
      Week: item.week_number || week,
      Year: item.year || year,
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Message: "No action items to export." }])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Action Points")

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
    saveAs(
      new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      buildActionPointFilename({
        week,
        year,
        meetingDate,
        extension: "xlsx",
        department: department || "All Departments",
      })
    )
  } finally {
    inFlightActionPointFileExports.delete(exportKey)
  }
}

export const exportToXLSX = async (report: WeeklyReport, meetingDate?: string) => {
  const buildSectionRows = (section: string, text: string) => {
    const lines = autoNumberLines(text || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)

    if (lines.length === 0) {
      return [
        {
          Department: report.department,
          Week: report.week_number,
          Year: report.year,
          Section: section,
          "Item #": "",
          Item: "No entry",
        },
      ]
    }

    return lines.map((line, index) => ({
      Department: report.department,
      Week: report.week_number,
      Year: report.year,
      Section: section,
      "Item #": index + 1,
      Item: line.replace(/^(?:\s*\d+[.)]\s*)+/, "").trim(),
    }))
  }

  const XLSX = await import("@e965/xlsx")
  const rows = [
    ...buildSectionRows("Work Done", report.work_done || ""),
    ...buildSectionRows("Tasks for New Week", report.tasks_new_week || ""),
    ...buildSectionRows("Challenges", report.challenges || ""),
  ]

  const worksheet = XLSX.utils.json_to_sheet(rows)
  worksheet["!cols"] = [{ wch: 28 }, { wch: 8 }, { wch: 8 }, { wch: 20 }, { wch: 8 }, { wch: 90 }]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Weekly Report")

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
  saveAs(
    new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    buildWeeklyReportFilename({
      week: report.week_number,
      year: report.year,
      meetingDate,
      extension: "xlsx",
      department: report.department,
    })
  )
}

export const exportAllToXLSX = async (reports: WeeklyReport[], week: number, year: number, meetingDate?: string) => {
  const buildSectionRows = (report: WeeklyReport, section: string, text: string) => {
    const lines = autoNumberLines(text || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)

    if (lines.length === 0) {
      return [
        {
          Department: report.department,
          Week: report.week_number,
          Year: report.year,
          Section: section,
          "Item #": "",
          Item: "No entry",
        },
      ]
    }

    return lines.map((line, index) => ({
      Department: report.department,
      Week: report.week_number,
      Year: report.year,
      Section: section,
      "Item #": index + 1,
      Item: line.replace(/^(?:\s*\d+[.)]\s*)+/, "").trim(),
    }))
  }

  const XLSX = await import("@e965/xlsx")
  const sortedReports = sortReportsByDepartment(reports)
  const rows = sortedReports.flatMap((report) => [
    ...buildSectionRows(report, "Work Done", report.work_done || ""),
    ...buildSectionRows(report, "Tasks for New Week", report.tasks_new_week || ""),
    ...buildSectionRows(report, "Challenges", report.challenges || ""),
  ])

  const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Message: "No weekly reports to export." }])
  worksheet["!cols"] = [{ wch: 28 }, { wch: 8 }, { wch: 8 }, { wch: 20 }, { wch: 8 }, { wch: 90 }]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Weekly Reports")

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
  saveAs(
    new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    buildWeeklyReportFilename({
      week,
      year,
      meetingDate,
      extension: "xlsx",
      allDepartments: true,
    })
  )
}

// ─── ACOB PPTX Design Helpers ────────────────────────────────────────────────
// ACOB brand colours
