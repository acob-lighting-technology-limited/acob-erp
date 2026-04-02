import { NextRequest, NextResponse } from "next/server"
import { Buffer } from "node:buffer"
import { generateActionPointsDocxBuffer } from "@/lib/reports/action-points-template"
import { generateActionPointsPdfFromDocxBuffer } from "@/lib/reports/action-points-word-pdf"
import type { ActionItem } from "@/lib/export-utils"
import { normalizeDepartmentName } from "@/shared/departments"

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

  return [
    `ACOB Action Points`,
    department ? sanitizeFilenameSegment(normalizeDepartmentName(department)) : null,
    dateLabel,
    `W${week}`,
  ]
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
  try {
    const body = (await request.json()) as ExportBody
    const { actions, week, year, meetingDate, department, format } = body

    if (format === "pdf") {
      const normalizedActions: ActionItem[] = (Array.isArray(actions) ? actions : []).map((action) => ({
        id: String(action.id),
        title: typeof action.title === "string" ? action.title : "",
        description: typeof action.description === "string" ? action.description : undefined,
        department: String(action.department || ""),
        status: String(action.status || "pending"),
        week_number: Number(action.week_number || week),
        year: Number(action.year || year),
      }))

      const pdfBuffer = await generateActionPointsPdfFromDocxBuffer(normalizedActions, week, year, meetingDate)

      return new NextResponse(new Blob([Buffer.from(pdfBuffer)], { type: "application/pdf" }), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${buildActionPointsFilename({ week, year, meetingDate, extension: "pdf", department })}"`,
        },
      })
    }

    const docxBuffer = await generateActionPointsDocxBuffer(actions, week, year, meetingDate)

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to export Action Points"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
