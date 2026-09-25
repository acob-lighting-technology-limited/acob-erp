import { toast } from "sonner"
import { logger } from "@/lib/logger"
import { formatWATDate, toLocalISODate } from "@/lib/utils/date"

const log = logger("scorecard-export")
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RegisterExportRow {
  source_sn: number
  strategic_priority?: string | null
  perspective: string
  strategic_objective: string
  target_text: string
  measure: string
  measure_type: string
  direction: string
  assignments?: Array<{
    department: string
    role: "core" | "support"
    department_target?: string | null
    target_value?: number | null
    target_unit?: string | null
  }>
  overall_attainment?: number | null
}

export interface CascadeExportRow {
  source_sn: number
  department?: string
  strategic_priority?: string | null
  perspective: string
  strategic_objective: string
  measure: string
  target_text: string
  role: "core" | "support"
  target_value?: number | null
  target_unit?: string | null
  department_target?: string | null
  effective_actual?: number | null
  effective_milestones_completed?: number | null
  effective_milestones_total?: number | null
  latest_actual?: {
    actual_value?: number | null
    milestones_completed?: number | null
    milestones_total?: number | null
    note?: string | null
    recorded_at?: string
  } | null
  source?: "auto" | "manual" | "none"
  is_override?: boolean
  capped_pct?: number | null
  raw_pct?: number | null
  proposed_action?: string | null
}

export interface SummaryExportData {
  companyPct: number | null
  perspectives: Array<{
    perspective: string
    attainmentPct: number | null
    objectives: Array<{ strategicObjective: string; attainmentPct: number | null; kpiCount: number }>
  }>
  departments: Array<{
    department: string
    coreKpiCount: number
    recordedKpiCount: number
    attainmentPct: number | null
    status: string | null
  }>
}

function ragLabel(pct: number | null): string {
  if (pct == null) return "No data"
  if (pct >= 95) return "On Target"
  if (pct >= 80) return "Needs Attention"
  return "At Risk"
}

// ─── 1. Master KPI Register Export ───────────────────────────────────────────

export async function exportScorecardRegisterToExcel(rows: RegisterExportRow[], filename?: string): Promise<void> {
  try {
    const XLSX = await import("@e965/xlsx")
    const { default: saveAs } = await import("file-saver")

    const flatRows = rows.map((r) => {
      const coreDepts = (r.assignments || [])
        .filter((a) => a.role === "core")
        .map((a) => {
          const quota =
            a.department_target || (a.target_value != null ? `${a.target_value} ${a.target_unit || ""}`.trim() : null)
          return quota ? `${a.department} (${quota})` : a.department
        })
        .join("; ")

      const supportDepts = (r.assignments || [])
        .filter((a) => a.role === "support")
        .map((a) => a.department)
        .join("; ")

      return {
        "S/N": r.source_sn,
        Pillar: r.strategic_priority || "-",
        Perspective: r.perspective,
        "Strategic Objective": r.strategic_objective,
        "2026 Target": r.target_text,
        "KPI Measure": r.measure,
        Type: r.measure_type,
        Direction: r.direction === "at_most" ? "At most (lower is better)" : "At least (higher is better)",
        "CORE Departments": coreDepts || "-",
        "SUPPORT Departments": supportDepts || "-",
        "Attainment %": r.overall_attainment != null ? `${r.overall_attainment}%` : "-",
      }
    })

    const ws = XLSX.utils.json_to_sheet(flatRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Master KPI Register")

    const cols = Object.keys(flatRows[0] || {}).map((key) => ({
      wch: Math.min(
        50,
        Math.max(key.length, ...flatRows.map((row) => String(row[key as keyof typeof row] ?? "").length)) + 2
      ),
    }))
    ws["!cols"] = cols

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    saveAs(
      new Blob([excelBuffer], { type: XLSX_MIME }),
      filename ? `${filename}.xlsx` : `corporate-scorecard-register-${toLocalISODate()}.xlsx`
    )
    toast.success("Master KPI register exported to Excel")
  } catch (err) {
    log.error({ err: String(err) }, "Failed to export register to Excel")
    toast.error("Failed to export to Excel")
  }
}

export async function exportScorecardRegisterToPdf(rows: RegisterExportRow[], filename?: string): Promise<void> {
  try {
    const jsPDF = (await import("jspdf")).default
    const autoTable = (await import("jspdf-autotable")).default

    const doc = new jsPDF({ orientation: "landscape" })

    doc.setFontSize(15)
    doc.text("Corporate Scorecard — Master KPI Register (2026)", 14, 15)
    doc.setFontSize(9)
    doc.text(`Generated on: ${formatWATDate(new Date())} · Total KPIs: ${rows.length}`, 14, 21)

    const headers = ["S/N", "Pillar", "Perspective", "KPI Measure", "2026 Target", "CORE Departments", "Attainment"]
    const body = rows.map((r) => {
      const coreDepts = (r.assignments || [])
        .filter((a) => a.role === "core")
        .map((a) => a.department)
        .join(", ")

      return [
        String(r.source_sn),
        r.strategic_priority || "-",
        r.perspective,
        r.measure,
        r.target_text,
        coreDepts || "-",
        r.overall_attainment != null ? `${r.overall_attainment}%` : "-",
      ]
    })

    autoTable(doc, {
      head: [headers],
      body,
      startY: 26,
      styles: { fontSize: 7, cellPadding: 1.8 },
      headStyles: { fillColor: [22, 101, 52], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 35 },
        2: { cellWidth: 30 },
        3: { cellWidth: 65 },
        4: { cellWidth: 65 },
        5: { cellWidth: 45 },
        6: { cellWidth: 20 },
      },
    })

    doc.save(filename ? `${filename}.pdf` : `corporate-scorecard-register-${toLocalISODate()}.pdf`)
    toast.success("Master KPI register exported to PDF")
  } catch (err) {
    log.error({ err: String(err) }, "Failed to export register to PDF")
    toast.error("Failed to export to PDF")
  }
}

// ─── 2. Department Cascade Export ────────────────────────────────────────────

export async function exportDepartmentCascadeToExcel(
  rows: CascadeExportRow[],
  department: string,
  filename?: string
): Promise<void> {
  try {
    const XLSX = await import("@e965/xlsx")
    const { default: saveAs } = await import("file-saver")

    const flatRows = rows.map((r) => {
      let actualDisplay = "-"
      if (r.effective_actual != null) {
        actualDisplay = `${r.effective_actual} ${r.target_unit || ""}`.trim()
      } else if (r.effective_milestones_completed != null) {
        actualDisplay = `${r.effective_milestones_completed}/${r.effective_milestones_total ?? 3} ms`
      } else if (r.latest_actual?.actual_value != null) {
        actualDisplay = `${r.latest_actual.actual_value}`
      }

      const targetDisplay =
        r.department_target ||
        (r.target_value != null ? `${r.target_value} ${r.target_unit || ""}`.trim() : r.target_text)

      return {
        "S/N": r.source_sn,
        Department: r.department || department,
        Pillar: r.strategic_priority || "-",
        Perspective: r.perspective,
        "KPI Measure": r.measure,
        "Strategic Objective": r.strategic_objective,
        Role: r.role.toUpperCase(),
        Target: targetDisplay,
        Actual: actualDisplay,
        Source: r.source === "auto" ? "Live Auto" : r.source === "manual" ? "Manual Override" : "None",
        "Attainment %": r.capped_pct != null ? `${r.capped_pct}%` : "-",
        Status: ragLabel(r.capped_pct ?? null),
        "Action Plan": r.proposed_action || "-",
        "Latest Note": r.latest_actual?.note || "-",
      }
    })

    const ws = XLSX.utils.json_to_sheet(flatRows)
    const wb = XLSX.utils.book_new()
    const sheetTitle = department === "all" ? "All Departments" : department.slice(0, 31)
    XLSX.utils.book_append_sheet(wb, ws, sheetTitle)

    const cols = Object.keys(flatRows[0] || {}).map((key) => ({
      wch: Math.min(
        45,
        Math.max(key.length, ...flatRows.map((row) => String(row[key as keyof typeof row] ?? "").length)) + 2
      ),
    }))
    ws["!cols"] = cols

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    const baseName =
      department === "all"
        ? "corporate-scorecard-all-departments"
        : `corporate-scorecard-${department.toLowerCase().replace(/\s+/g, "-")}`
    saveAs(
      new Blob([excelBuffer], { type: XLSX_MIME }),
      filename ? `${filename}.xlsx` : `${baseName}-${toLocalISODate()}.xlsx`
    )
    toast.success("Department KPIs exported to Excel")
  } catch (err) {
    log.error({ err: String(err) }, "Failed to export cascade to Excel")
    toast.error("Failed to export to Excel")
  }
}

export async function exportDepartmentCascadeToPdf(
  rows: CascadeExportRow[],
  department: string,
  filename?: string
): Promise<void> {
  try {
    const jsPDF = (await import("jspdf")).default
    const autoTable = (await import("jspdf-autotable")).default

    const doc = new jsPDF({ orientation: "landscape" })
    const deptTitle = department === "all" ? "All Departments" : department

    doc.setFontSize(15)
    doc.text(`Corporate Scorecard — ${deptTitle} KPIs`, 14, 15)
    doc.setFontSize(9)
    doc.text(`Generated on: ${formatWATDate(new Date())} · Showing ${rows.length} KPIs`, 14, 21)

    const headers = ["S/N", "Pillar", "KPI Measure", "Role", "Target", "Actual", "Source", "Attainment", "Status"]
    const body = rows.map((r) => {
      let actualDisplay = "-"
      if (r.effective_actual != null) {
        actualDisplay = `${r.effective_actual} ${r.target_unit || ""}`.trim()
      } else if (r.effective_milestones_completed != null) {
        actualDisplay = `${r.effective_milestones_completed}/${r.effective_milestones_total ?? 3}`
      }

      const targetDisplay = r.department_target || (r.target_value != null ? `${r.target_value}` : r.target_text)

      return [
        String(r.source_sn),
        r.strategic_priority || "-",
        r.measure,
        r.role.toUpperCase(),
        targetDisplay,
        actualDisplay,
        r.source === "auto" ? "Auto" : r.source === "manual" ? "Manual" : "-",
        r.capped_pct != null ? `${r.capped_pct}%` : "-",
        ragLabel(r.capped_pct ?? null),
      ]
    })

    autoTable(doc, {
      head: [headers],
      body,
      startY: 26,
      styles: { fontSize: 7, cellPadding: 1.8 },
      headStyles: { fillColor: [22, 101, 52], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 35 },
        2: { cellWidth: 70 },
        3: { cellWidth: 18 },
        4: { cellWidth: 45 },
        5: { cellWidth: 25 },
        6: { cellWidth: 18 },
        7: { cellWidth: 22 },
        8: { cellWidth: 27 },
      },
    })

    const baseName =
      department === "all"
        ? "corporate-scorecard-all-departments"
        : `corporate-scorecard-${department.toLowerCase().replace(/\s+/g, "-")}`
    doc.save(filename ? `${filename}.pdf` : `${baseName}-${toLocalISODate()}.pdf`)
    toast.success("Department KPIs exported to PDF")
  } catch (err) {
    log.error({ err: String(err) }, "Failed to export cascade to PDF")
    toast.error("Failed to export to PDF")
  }
}

// ─── 3. Executive Summary Export ─────────────────────────────────────────────

export async function exportSummaryToExcel(data: SummaryExportData, filename?: string): Promise<void> {
  try {
    const XLSX = await import("@e965/xlsx")
    const { default: saveAs } = await import("file-saver")

    const deptRows = data.departments.map((d, index) => ({
      "S/N": index + 1,
      Department: d.department,
      "CORE KPIs": d.coreKpiCount,
      "Recorded / Active": `${d.recordedKpiCount} / ${d.coreKpiCount}`,
      "Attainment %": d.attainmentPct != null ? `${d.attainmentPct}%` : "No data",
      Status: ragLabel(d.attainmentPct),
    }))

    const perspectiveRows = data.perspectives.map((p) => ({
      Perspective: p.perspective,
      "Attainment %": p.attainmentPct != null ? `${p.attainmentPct}%` : "No data",
      "Strategic Objectives": p.objectives.map((o) => `${o.strategicObjective} (${o.kpiCount} KPIs)`).join("; "),
    }))

    const wb = XLSX.utils.book_new()
    const ws1 = XLSX.utils.json_to_sheet(deptRows)
    const ws2 = XLSX.utils.json_to_sheet(perspectiveRows)

    XLSX.utils.book_append_sheet(wb, ws1, "Department Attainment")
    XLSX.utils.book_append_sheet(wb, ws2, "Perspective Rollup")

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    saveAs(
      new Blob([excelBuffer], { type: XLSX_MIME }),
      filename ? `${filename}.xlsx` : `corporate-scorecard-summary-${toLocalISODate()}.xlsx`
    )
    toast.success("Executive summary exported to Excel")
  } catch (err) {
    log.error({ err: String(err) }, "Failed to export summary to Excel")
    toast.error("Failed to export to Excel")
  }
}

export async function exportSummaryToPdf(data: SummaryExportData, filename?: string): Promise<void> {
  try {
    const jsPDF = (await import("jspdf")).default
    const autoTable = (await import("jspdf-autotable")).default

    const doc = new jsPDF({ orientation: "portrait" })

    doc.setFontSize(16)
    doc.text("Corporate Scorecard — Executive Summary", 14, 16)
    doc.setFontSize(9)
    doc.text(`Generated on: ${formatWATDate(new Date())}`, 14, 22)

    // Summary KPI banner
    doc.setFontSize(11)
    doc.text(`Company-Wide Attainment: ${data.companyPct != null ? `${data.companyPct}%` : "No data"}`, 14, 30)

    doc.setFontSize(8)
    const perspectiveTexts = data.perspectives.map(
      (p) => `${p.perspective}: ${p.attainmentPct != null ? `${p.attainmentPct}%` : "No data"}`
    )
    doc.text(perspectiveTexts.join("  |  "), 14, 35)

    const headers = ["S/N", "Department", "CORE KPIs", "Recorded / Active", "Attainment", "Status"]
    const body = data.departments.map((d, index) => [
      String(index + 1),
      d.department,
      String(d.coreKpiCount),
      `${d.recordedKpiCount} / ${d.coreKpiCount}`,
      d.attainmentPct != null ? `${d.attainmentPct}%` : "No data",
      ragLabel(d.attainmentPct),
    ])

    autoTable(doc, {
      head: [headers],
      body,
      startY: 40,
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: [22, 101, 52], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    })

    doc.save(filename ? `${filename}.pdf` : `corporate-scorecard-summary-${toLocalISODate()}.pdf`)
    toast.success("Executive summary exported to PDF")
  } catch (err) {
    log.error({ err: String(err) }, "Failed to export summary to PDF")
    toast.error("Failed to export to PDF")
  }
}
