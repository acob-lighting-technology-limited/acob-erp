"use client"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { sanitizeReportText } from "@/lib/export/shared"
import {
  REPORT_TEXT_FIELDS,
  replaceSelectedText,
  type ReportTextField,
  type ReportTexts,
} from "@/lib/reports/weekly-report-text"

interface WeeklyReportTextFieldsProps {
  values: ReportTexts
  onChange: (field: ReportTextField, value: string) => void
  /** Whole form is read-only (e.g. the week is locked). */
  readOnly?: boolean
  /** Next week's tracker already has activity, so its task list is frozen. */
  isNextWeekActive?: boolean
  nextWeekActiveNote?: string
}

function moveCaret(textarea: HTMLTextAreaElement, position: number) {
  requestAnimationFrame(() => {
    textarea.selectionStart = position
    textarea.selectionEnd = position
  })
}

/**
 * The three numbered text areas of a weekly report. Enter continues the
 * numbering, Backspace on an empty "3. " removes the number, and pasted text is
 * sanitised — shared by the staff and admin report dialogs.
 */
export function WeeklyReportTextFields({
  values,
  onChange,
  readOnly = false,
  isNextWeekActive = false,
  nextWeekActiveNote = "Locked: Next week's tracker already has activity.",
}: WeeklyReportTextFieldsProps) {
  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>, field: ReportTextField) => {
    const textarea = e.currentTarget
    const current = values[field]

    if (e.key === "Backspace") {
      if (textarea.selectionStart !== textarea.selectionEnd) return
      const caret = textarea.selectionStart ?? 0
      const lineStart = current.lastIndexOf("\n", Math.max(0, caret - 1)) + 1
      if (/^\d+[.)]\s*$/.test(current.slice(lineStart, caret))) {
        e.preventDefault()
        onChange(field, `${current.slice(0, lineStart)}${current.slice(caret)}`)
        moveCaret(textarea, lineStart)
      }
      return
    }

    if (e.key === "Enter") {
      const caret = textarea.selectionStart ?? current.length
      const lineStart = current.lastIndexOf("\n", Math.max(0, caret - 1)) + 1
      const lineEndIndex = current.indexOf("\n", caret)
      const currentLine = current.slice(lineStart, lineEndIndex === -1 ? current.length : lineEndIndex)
      const match = currentLine.match(/^\s*(\d+)[.)]\s/)
      if (match) {
        e.preventDefault()
        const prefix = `\n${parseInt(match[1], 10) + 1}. `
        onChange(field, replaceSelectedText(current, prefix, textarea.selectionStart, textarea.selectionEnd))
        moveCaret(textarea, caret + prefix.length)
      }
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>, field: ReportTextField) => {
    e.preventDefault()
    const pasted = sanitizeReportText(e.clipboardData.getData("text"))
    const current = values[field] || ""
    const textarea = e.currentTarget
    onChange(field, replaceSelectedText(current, pasted, textarea.selectionStart, textarea.selectionEnd))
    moveCaret(textarea, (textarea.selectionStart ?? current.length) + pasted.length)
  }

  return (
    <>
      {REPORT_TEXT_FIELDS.map((f) => (
        <div key={f} className="space-y-2">
          <Label className="capitalize">
            {f.replace(/_/g, " ")}
            {f === "challenges" && (
              <span className="text-muted-foreground ml-1 font-normal normal-case">(leave blank if none)</span>
            )}
          </Label>
          <Textarea
            value={values[f]}
            onChange={(e) => onChange(f, sanitizeReportText(e.target.value))}
            onPaste={(e) => handlePaste(e, f)}
            onKeyDown={(e) => handleKey(e, f)}
            placeholder={f === "challenges" ? "Leave blank if there are no challenges" : `1. ...`}
            rows={4}
            readOnly={readOnly}
            disabled={readOnly || (f === "tasks_new_week" && isNextWeekActive)}
          />
          {f === "tasks_new_week" && isNextWeekActive && !readOnly && (
            <p className="text-muted-foreground text-xs italic">{nextWeekActiveNote}</p>
          )}
        </div>
      ))}
    </>
  )
}
