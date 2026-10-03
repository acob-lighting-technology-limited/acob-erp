/** Weekly report and action-point Word exports (docx). Split out of lib/export-utils.ts (audit 5.10). */
import { saveAs } from "file-saver"
import {
  Document,
  Footer,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
} from "docx"

import {
  WeeklyReport,
  formatExportMeetingDateLabel,
  buildWeeklyReportFilename,
  buildActionPointFilename,
  sortReportsByDepartment,
  ActionItem,
  groupActionItemsByDepartment,
  SECTION_TASKS,
  SECTION_CHALLENGES,
} from "./shared"

const docxSectionHeading = (title: string, hexBg: string) =>
  new Paragraph({
    children: [
      new TextRun({
        text: title,
        bold: true,
        color: hexBg,
        size: 22,
      }),
    ],
    border: { bottom: { color: hexBg, size: 8, style: "single" } },
    spacing: { before: 200, after: 80 },
  })

/** Converts text to numbered Paragraph array. */
const docxNumberedItems = (text: string, fallback: string) => {
  const lines = text?.split("\n").filter(Boolean) ?? []
  if (lines.length === 0) return [new Paragraph({ text: fallback, spacing: { after: 60 } })]
  return lines.map(
    (l, i) =>
      new Paragraph({
        children: [new TextRun(`${i + 1}. ${l.trim()}`)],
        indent: { left: 480, hanging: 360 },
        spacing: { after: 60 },
      })
  )
}

export const exportToDocx = async (report: WeeklyReport, meetingDate?: string) => {
  const p = Array.isArray(report.profiles) ? report.profiles[0] : report.profiles
  const name = p ? `${p.first_name} ${p.last_name}` : "Employee"
  const meetingDateLabel = formatExportMeetingDateLabel(report.week_number, report.year, meetingDate)

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "ACOB LIGHTING TECHNOLOGY LIMITED", bold: true, size: 36, color: "1A7A4A" }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "General Meeting  ·  Weekly Report", size: 26, color: "334155" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Week ${report.week_number}  ·  ${report.year}`,
                bold: true,
                size: 22,
                color: "1A7A4A",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [new TextRun({ text: meetingDateLabel, size: 20, color: "64748B" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [new TextRun({ text: report.department, italics: true, size: 20, color: "1A7A4A" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Department", bold: true })] })],
                    width: { size: 30, type: WidthType.PERCENTAGE },
                  }),
                  new TableCell({ children: [new Paragraph(report.department)] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Employee", bold: true })] })],
                  }),
                  new TableCell({ children: [new Paragraph(name)] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Period", bold: true })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph(`Week ${report.week_number}, ${report.year}`)],
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({ text: "", spacing: { after: 200 } }),
          docxSectionHeading("WORK DONE", "1A7A4A"),
          ...docxNumberedItems(report.work_done, "No data provided."),
          new Paragraph({ text: "", spacing: { after: 120 } }),
          docxSectionHeading("TASKS FOR NEW WEEK", SECTION_TASKS),
          ...docxNumberedItems(report.tasks_new_week, "No data provided."),
          new Paragraph({ text: "", spacing: { after: 120 } }),
          docxSectionHeading("CHALLENGES", SECTION_CHALLENGES),
          ...docxNumberedItems(report.challenges, "No challenges reported."),
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(
    blob,
    buildWeeklyReportFilename({
      week: report.week_number,
      year: report.year,
      meetingDate,
      extension: "docx",
      department: report.department,
    })
  )
}

/**
 * Exports the Action Point to a DOCX document.
 */
export const exportActionPointToDocx = async (
  actions: ActionItem[],
  week: number,
  year: number,
  meetingDate?: string,
  department?: string
) => {
  const meetingDateLabel = formatExportMeetingDateLabel(week, year, meetingDate)

  const { grouped, departments } = groupActionItemsByDepartment(actions)

  const pageFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT] })],
      }),
    ],
  })

  const tocRows = departments.map(
    (dept, i) =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(dept)] }),
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun(String(i + 3))] })],
          }),
        ],
      })
  )

  const deptChildren: Array<Paragraph | Table> = []
  departments.forEach((dept, i) => {
    const deptActions = grouped[dept] || []
    deptChildren.push(
      new Paragraph({
        children: [new TextRun({ text: dept.toUpperCase(), bold: true, size: 28, color: "1A7A4A" })],
        pageBreakBefore: i > 0,
        spacing: { after: 100 },
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({ children: [new TextRun({ text: "ACTION ITEM", bold: true, color: "FFFFFF" })] }),
                ],
                shading: { type: ShadingType.SOLID, color: "1A7A4A", fill: "1A7A4A" },
                width: { size: 75, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "STATUS", bold: true, color: "FFFFFF" })] })],
                shading: { type: ShadingType.SOLID, color: "1A7A4A", fill: "1A7A4A" },
                width: { size: 25, type: WidthType.PERCENTAGE },
              }),
            ],
          }),
          ...deptActions.map(
            (a) =>
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph(a.title)] }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: a.status.replace("_", " ").toUpperCase(), bold: true })],
                      }),
                    ],
                  }),
                ],
              })
          ),
        ],
      }),
      new Paragraph({ text: "", spacing: { after: 120 } })
    )
  })

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "ACOB LIGHTING TECHNOLOGY LIMITED", bold: true, size: 36, color: "1A7A4A" }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "General Meeting  ·  Action Points", size: 26, color: "334155" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `Week ${week}  ·  ${year}`, bold: true, size: 22, color: "1A7A4A" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [new TextRun({ text: meetingDateLabel, size: 20, color: "64748B" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Departments in This Report", bold: true, size: 24, color: "0F2D1F" })],
            spacing: { after: 100 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tocRows,
          }),
        ],
      },
      {
        properties: { page: { pageNumbers: { start: 3 } } },
        footers: { default: pageFooter },
        children: deptChildren,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, buildActionPointFilename({ week, year, meetingDate, extension: "docx", department }))
}

export const exportAllToDocx = async (reports: WeeklyReport[], week: number, year: number, meetingDate?: string) => {
  const sortedReports = sortReportsByDepartment(reports)
  const meetingDateLabel = formatExportMeetingDateLabel(week, year, meetingDate)

  const tocChildren: Array<Paragraph | Table> = [
    new Paragraph({
      children: [new TextRun({ text: "ACOB LIGHTING TECHNOLOGY LIMITED", bold: true, size: 36, color: "1A7A4A" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "General Meeting  ·  Weekly Report", size: 26, color: "334155" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Week ${week}  ·  ${year}`, bold: true, size: 22, color: "1A7A4A" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: meetingDateLabel, size: 20, color: "64748B" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Departments in This Report", bold: true, size: 24, color: "0F2D1F" })],
      spacing: { after: 100 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: sortedReports.map(
        (r, i) =>
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph(r.department)] }),
              new TableCell({
                width: { size: 15, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun(String(i + 3))] })],
              }),
            ],
          })
      ),
    }),
  ]

  const reportChildren: Paragraph[] = []
  sortedReports.forEach((report, idx) => {
    reportChildren.push(
      new Paragraph({
        children: [new TextRun({ text: report.department.toUpperCase(), bold: true, size: 32, color: "FFFFFF" })],
        shading: { type: ShadingType.SOLID, color: "1A7A4A", fill: "1A7A4A" },
        pageBreakBefore: idx > 0,
        spacing: { after: 80 },
      }),
      docxSectionHeading("WORK DONE", "1A7A4A"),
      ...docxNumberedItems(report.work_done, "No data provided."),
      new Paragraph({ text: "", spacing: { after: 120 } }),
      docxSectionHeading("TASKS FOR NEW WEEK", SECTION_TASKS),
      ...docxNumberedItems(report.tasks_new_week, "No data provided."),
      new Paragraph({ text: "", spacing: { after: 120 } }),
      docxSectionHeading("CHALLENGES", SECTION_CHALLENGES),
      ...docxNumberedItems(report.challenges, "No challenges reported."),
      new Paragraph({ text: "", spacing: { after: 120 } })
    )
  })

  const pageFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT] })],
      }),
    ],
  })

  const doc = new Document({
    sections: [
      { children: tocChildren },
      {
        properties: { page: { pageNumbers: { start: 3 } } },
        footers: { default: pageFooter },
        children: reportChildren,
      },
    ],
  })
  const blob = await Packer.toBlob(doc)
  saveAs(
    blob,
    buildWeeklyReportFilename({
      week,
      year,
      meetingDate,
      extension: "docx",
      allDepartments: true,
    })
  )
}
