import { toast } from "sonner"
import { logger } from "@/lib/logger"
import { formatWATDate, formatWATDateTime, toLocalISODate } from "@/lib/utils/date"
import { formatTaskStatus } from "@/lib/tasks/constants"
import { isTaskOverdue } from "@/lib/tasks/overdue"
import { TASK_WEIGHT_DEFAULT } from "@/lib/tasks/scoring"
import type { Task } from "@/types/task"

const log = logger("tasks-export")

type Cell = string | number
type ExportRow = Record<string, Cell>

/** One employee's aggregate for the selected period (mirrors UserPlanRow). */
export interface UserPlanExportRow {
  name: string
  email: string
  department: string
  totalTasks: number
  completedCount: number
  inProgressCount: number
  pendingCount: number
  submittedCount: number
  otherCount: number
  totalWeight: number
  ratedCount: number
  avgRating: number | null
  kpiScore: number | null
  completionRate: number
  tasks: Task[]
}

/** Describes what the export was filtered to, printed at the top of every file. */
export interface TaskExportMeta {
  /** e.g. "Week 37, 2026 (8 Sep 2026 – 14 Sep 2026)" */
  periodLabel?: string
  /** Human-readable active filters and search, e.g. ["Department: Finance"] */
  filters: string[]
  generatedBy?: string
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

function fileStamp() {
  return toLocalISODate()
}

function dateOrDash(value?: string | null) {
  return value ? formatWATDate(value) : "-"
}

function earnedPoints(task: Task): number | null {
  if (!task.rating) return null
  const weight = task.weight ?? TASK_WEIGHT_DEFAULT
  return Math.round(((weight * task.rating) / 5) * 100) / 100
}

function metaLines(meta: TaskExportMeta): string[] {
  const lines: string[] = []
  if (meta.periodLabel) lines.push(`Period: ${meta.periodLabel}`)
  lines.push(`Filters: ${meta.filters.length > 0 ? meta.filters.join(" · ") : "None"}`)
  lines.push(`Generated: ${formatWATDateTime(new Date())}${meta.generatedBy ? ` by ${meta.generatedBy}` : ""}`)
  return lines
}

// ─── Row builders ────────────────────────────────────────────────────────────

function userPlanSummaryRow(r: UserPlanExportRow, today: string): ExportRow {
  return {
    Employee: r.name,
    Email: r.email,
    Department: r.department,
    "Total Tasks": r.totalTasks,
    Completed: r.completedCount,
    "In Progress": r.inProgressCount,
    Pending: r.pendingCount,
    Submitted: r.submittedCount,
    Other: r.otherCount,
    Overdue: r.tasks.filter((t) => isTaskOverdue(t, today)).length,
    "Completion %": r.completionRate,
    "Weight Points": r.totalWeight,
    "Rated Tasks": r.ratedCount,
    "Avg Rating (/5)": r.avgRating ?? "Unrated",
    "KPI Attainment %": r.kpiScore ?? "-",
  }
}

function userPlanTaskRow(r: UserPlanExportRow, task: Task, today: string): ExportRow {
  const weight = task.weight ?? TASK_WEIGHT_DEFAULT
  const earned = earnedPoints(task)
  return {
    Employee: r.name,
    Department: r.department,
    "Task ID": task.work_item_number || "-",
    Task: task.title,
    Status: formatTaskStatus(task.status),
    Priority: task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : "-",
    Assignment: String(task.assignment_type || "individual").replace(/_/g, " "),
    Weight: weight,
    "Due Date": dateOrDash(task.due_date),
    "Completed Date": dateOrDash(task.completed_at),
    Overdue: isTaskOverdue(task, today) ? "Yes" : "No",
    Rating: task.rating ? `${task.rating} / 5` : "Unrated",
    "Earned Points": earned === null ? "-" : `${earned} / ${weight}`,
    Goal: task.goal_title || "-",
    KPI: task.kpi_measure || "-",
    Project: task.project_name || "-",
  }
}

function taskListRow(task: Task, ownerLabel: (task: Task) => string, today: string): ExportRow {
  return {
    "Task ID": task.work_item_number || "-",
    Title: task.title,
    Assignee: ownerLabel(task),
    Department: task.department || "General",
    Status: formatTaskStatus(task.status),
    Priority: task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : "-",
    Weight: task.weight ?? TASK_WEIGHT_DEFAULT,
    "Due Date": dateOrDash(task.due_date),
    Overdue: isTaskOverdue(task, today) ? "Yes" : "No",
    Rating: task.rating ? `${task.rating} / 5` : "Unrated",
    Goal: task.goal_title || "-",
    KPI: task.kpi_measure || "-",
    Project: task.project_name || "-",
    Created: dateOrDash(task.created_at),
    "Completed Date": dateOrDash(task.completed_at),
  }
}

// ─── Writers ─────────────────────────────────────────────────────────────────

/** A sheet whose first rows are the title + meta block, then a blank row, then the table. */
async function buildSheet(title: string, meta: TaskExportMeta, rows: ExportRow[], emptyHeaders: string[]) {
  const XLSX = await import("@e965/xlsx")
  const preamble = [[title], ...metaLines(meta).map((l) => [l]), []]
  const sheet = XLSX.utils.aoa_to_sheet(preamble)
  if (rows.length > 0) {
    XLSX.utils.sheet_add_json(sheet, rows, { origin: preamble.length })
    const headers = Object.keys(rows[0])
    sheet["!cols"] = headers.map((h) => ({
      wch: Math.min(50, Math.max(h.length, ...rows.map((r) => String(r[h] ?? "").length)) + 2),
    }))
  } else {
    XLSX.utils.sheet_add_aoa(sheet, [emptyHeaders], { origin: preamble.length })
  }
  return sheet
}

async function saveWorkbook(sheets: Array<{ name: string; sheet: unknown }>, filename: string) {
  const XLSX = await import("@e965/xlsx")
  const { default: saveAs } = await import("file-saver")
  const workbook = XLSX.utils.book_new()
  for (const { name, sheet } of sheets) {
    XLSX.utils.book_append_sheet(workbook, sheet as Parameters<typeof XLSX.utils.book_append_sheet>[1], name)
  }
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
  saveAs(new Blob([buffer], { type: XLSX_MIME }), `${filename}.xlsx`)
}

async function newPdf(title: string, meta: TaskExportMeta) {
  const jsPDF = (await import("jspdf")).default
  const autoTable = (await import("jspdf-autotable")).default
  const doc = new jsPDF({ orientation: "landscape" })
  doc.setFontSize(16)
  doc.text(title, 14, 15)
  doc.setFontSize(9)
  const lines = metaLines(meta)
  lines.forEach((line, i) => doc.text(line, 14, 22 + i * 5))
  return { doc, autoTable, startY: 22 + lines.length * 5 + 2 }
}

const PDF_TABLE_STYLE = {
  styles: { fontSize: 7.5, cellPadding: 1.8 },
  headStyles: { fillColor: [22, 101, 52] as [number, number, number], textColor: 255 },
  alternateRowStyles: { fillColor: [245, 247, 250] as [number, number, number] },
}

function lastTableY(doc: unknown, fallback: number): number {
  return (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback
}

function toBody(rows: ExportRow[], headers: string[]) {
  return rows.map((row) => headers.map((h) => String(row[h] ?? "-")))
}

// ─── Public API: User Task Plan ──────────────────────────────────────────────

export async function exportUserPlanToExcel(rows: UserPlanExportRow[], meta: TaskExportMeta) {
  try {
    const today = toLocalISODate()
    const summary = rows.map((r) => userPlanSummaryRow(r, today))
    const detail = rows.flatMap((r) => r.tasks.map((t) => userPlanTaskRow(r, t, today)))
    const summarySheet = await buildSheet("User Task Plan — Summary", meta, summary, ["Employee"])
    const detailSheet = await buildSheet("User Task Plan — Tasks", meta, detail, ["Employee", "Task"])
    await saveWorkbook(
      [
        { name: "Summary", sheet: summarySheet },
        { name: "Tasks", sheet: detailSheet },
      ],
      `user-task-plan-${fileStamp()}`
    )
    toast.success("Exported to Excel")
  } catch (error) {
    log.error({ err: String(error) }, "Failed to export user task plan to Excel")
    toast.error("Failed to export to Excel")
  }
}

export async function exportUserPlanToPdf(
  rows: UserPlanExportRow[],
  meta: TaskExportMeta,
  { includeTasks }: { includeTasks: boolean }
) {
  try {
    const today = toLocalISODate()
    const { doc, autoTable, startY } = await newPdf("User Task Plan & Workload", meta)

    const summary = rows.map((r) => userPlanSummaryRow(r, today))
    // Email is in the Excel file; the landscape PDF has no room for it.
    const summaryHeaders = Object.keys(userPlanSummaryRow(EMPTY_PLAN_ROW, today)).filter((h) => h !== "Email")
    autoTable(doc, {
      head: [summaryHeaders],
      body: toBody(summary, summaryHeaders),
      startY,
      ...PDF_TABLE_STYLE,
    })

    if (includeTasks) {
      const detailHeaders = [
        "Task ID",
        "Task",
        "Status",
        "Priority",
        "Weight",
        "Due Date",
        "Completed Date",
        "Overdue",
        "Rating",
        "Earned Points",
        "Goal",
        "Project",
      ]
      for (const r of rows) {
        if (r.tasks.length === 0) continue
        let y = lastTableY(doc, startY) + 10
        if (y > doc.internal.pageSize.getHeight() - 30) {
          doc.addPage()
          y = 15
        }
        doc.setFontSize(11)
        doc.text(`${r.name} — ${r.department}`, 14, y)
        doc.setFontSize(8)
        doc.text(
          `${r.totalTasks} tasks · ${r.totalWeight} weight pts · ${r.completionRate}% completed · Avg rating ${r.avgRating ?? "Unrated"}`,
          14,
          y + 5
        )
        autoTable(doc, {
          head: [detailHeaders],
          body: toBody(
            r.tasks.map((t) => userPlanTaskRow(r, t, today)),
            detailHeaders
          ),
          startY: y + 8,
          ...PDF_TABLE_STYLE,
        })
      }
    }

    doc.save(`user-task-plan-${fileStamp()}.pdf`)
    toast.success("Exported to PDF")
  } catch (error) {
    log.error({ err: String(error) }, "Failed to export user task plan to PDF")
    toast.error("Failed to export to PDF")
  }
}

const EMPTY_PLAN_ROW: UserPlanExportRow = {
  name: "",
  email: "",
  department: "",
  totalTasks: 0,
  completedCount: 0,
  inProgressCount: 0,
  pendingCount: 0,
  submittedCount: 0,
  otherCount: 0,
  totalWeight: 0,
  ratedCount: 0,
  avgRating: null,
  kpiScore: null,
  completionRate: 0,
  tasks: [],
}

// ─── Public API: All Tasks ───────────────────────────────────────────────────

export async function exportTaskListToExcel(tasks: Task[], ownerLabel: (task: Task) => string, meta: TaskExportMeta) {
  try {
    const today = toLocalISODate()
    const rows = tasks.map((t) => taskListRow(t, ownerLabel, today))
    const sheet = await buildSheet("Task Management", meta, rows, ["Task ID", "Title"])
    await saveWorkbook([{ name: "Tasks", sheet }], `tasks-${fileStamp()}`)
    toast.success("Exported to Excel")
  } catch (error) {
    log.error({ err: String(error) }, "Failed to export tasks to Excel")
    toast.error("Failed to export to Excel")
  }
}

export async function exportTaskListToPdf(tasks: Task[], ownerLabel: (task: Task) => string, meta: TaskExportMeta) {
  try {
    const today = toLocalISODate()
    const rows = tasks.map((t) => taskListRow(t, ownerLabel, today))
    const { doc, autoTable, startY } = await newPdf("Task Management", meta)
    const headers = [
      "Task ID",
      "Title",
      "Assignee",
      "Department",
      "Status",
      "Priority",
      "Weight",
      "Due Date",
      "Overdue",
      "Rating",
      "Goal",
      "Project",
    ]
    autoTable(doc, { head: [headers], body: toBody(rows, headers), startY, ...PDF_TABLE_STYLE })
    doc.save(`tasks-${fileStamp()}.pdf`)
    toast.success("Exported to PDF")
  } catch (error) {
    log.error({ err: String(error) }, "Failed to export tasks to PDF")
    toast.error("Failed to export to PDF")
  }
}
