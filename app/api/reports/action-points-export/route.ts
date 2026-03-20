import { NextRequest, NextResponse } from "next/server"
import { Buffer } from "node:buffer"
import { convertOfficeDocumentToPdf } from "@/lib/reports/office-pdf"
import { generateActionPointsDocxBuffer } from "@/lib/reports/action-points-template"
import type { ActionItem } from "@/lib/export-utils"

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001F]+/g

const sanitizeFilenameSegment = (value: string) =>
  value.replace(INVALID_FILENAME_CHARS, " ").replace(/\s+/g, " ").trim()

const resolveMeetingDate = (week: number, year: number, meetingDate?: string) => {
  if (meetingDate) {
    const parsed = new Date(`${meetingDate}T00:00:00`)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }

  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7))
  while (simple.getUTCDay() !== 1) simple.setUTCDate(simple.getUTCDate() - 1)
  return simple
}

const buildActionPointsFilename = ({
  week,
  year,
  meetingDate,
  extension,
  department,
}: {
  week: number
  year: number
  meetingDate?: string
  extension: string
  department?: string
}) => {
  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(resolveMeetingDate(week, year, meetingDate))

  return [`ACOB Action Points`, department ? sanitizeFilenameSegment(department) : null, dateLabel, `W${week}`]
    .filter(Boolean)
    .join(" ")
    .concat(`.${extension}`)
}

type ExportBody = {
  actions: ActionItem[]
  week: number
  year: number
  meetingDate?: string
  department?: string
  format: "docx" | "pdf"
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ExportBody
  const { actions, week, year, meetingDate, department, format } = body

  const docxBuffer = await generateActionPointsDocxBuffer(actions, week, year, meetingDate)

  if (format === "pdf") {
    const converted = await convertOfficeDocumentToPdf(
      docxBuffer,
      buildActionPointsFilename({ week, year, meetingDate, extension: "pdf", department }).replace(/\.pdf$/, ""),
      "docx"
    )

    return new NextResponse(new Blob([Buffer.from(converted.buffer)], { type: converted.mimeType }), {
      headers: {
        "Content-Type": converted.mimeType,
        "Content-Disposition": `attachment; filename="${converted.fileName}"`,
      },
    })
  }

  return new NextResponse(
    new Blob([Buffer.from(docxBuffer)], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${buildActionPointsFilename({ week, year, meetingDate, extension: "docx", department })}"`,
      },
    }
  )
}
