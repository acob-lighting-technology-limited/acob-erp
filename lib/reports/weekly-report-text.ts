import { sanitizeReportText } from "@/lib/export/shared"

export const REPORT_TEXT_FIELDS = ["work_done", "tasks_new_week", "challenges"] as const
export type ReportTextField = (typeof REPORT_TEXT_FIELDS)[number]
export type ReportTexts = Record<ReportTextField, string>

export const EMPTY_REPORT_TEXTS: ReportTexts = { work_done: "", tasks_new_week: "", challenges: "" }

/** Normalise free text into "1. …\n2. …" lines, stripping any existing bullets or numbers. */
export function autoNumberReportText(text: string): string {
  const lines = sanitizeReportText(String(text || ""))
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^(?:\s*(?:\d+[.)]\s*|[-*]\s+))+/, "").trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) return ""
  return lines.map((line, index) => `${index + 1}. ${line}`).join("\n")
}

export function autoNumberReportTexts(texts: Partial<ReportTexts>): ReportTexts {
  return {
    work_done: autoNumberReportText(texts.work_done ?? ""),
    tasks_new_week: autoNumberReportText(texts.tasks_new_week ?? ""),
    challenges: autoNumberReportText(texts.challenges ?? ""),
  }
}

export function replaceSelectedText(
  current: string,
  insert: string,
  selectionStart: number | null | undefined,
  selectionEnd: number | null | undefined
) {
  const start = selectionStart ?? current.length
  const end = selectionEnd ?? current.length
  return `${current.slice(0, start)}${insert}${current.slice(end)}`
}
