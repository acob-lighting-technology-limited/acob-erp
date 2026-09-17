import { toast } from "sonner"
import { logger } from "@/lib/logger"
import { toLocalISODate } from "@/lib/utils/date"
import { RATING_LABELS, STATUS_LABELS, impactLabel, likelihoodLabel, riskReference, type RiskRow } from "./model"

const log = logger("risk-register-export")

export interface RiskExportContext {
  departmentCodes: Record<string, string | null>
  staffNames: Record<string, string>
}

function formatTimeline(risk: RiskRow): string {
  const when = risk.timeline_type === "continuous" ? "Continuous" : risk.target_date || ""
  return [when, risk.timeline_note].filter(Boolean).join(" — ")
}

/** One row in the template's own column order and headings. */
export function toTemplateRow(risk: RiskRow, ctx: RiskExportContext): Record<string, string | number> {
  const owner = risk.control_owner_id ? ctx.staffNames[risk.control_owner_id] : null
  return {
    "Risk S/N": risk.serial_no,
    Reference: riskReference(ctx.departmentCodes[risk.department], risk.department, risk.serial_no),
    "Risk Category/ Department or Unit": [risk.department, ...risk.supporting_departments].join(" / "),
    "Risk Name": risk.risk_name,
    "Risk Description": risk.description,
    Causes: risk.causes || "",
    "Potential Impact/Consequence": risk.consequence || "",
    "Inherent Impact": `${risk.impact} - ${impactLabel(risk.impact)}`,
    "Inherent Likelihood": `${risk.likelihood} - ${likelihoodLabel(risk.likelihood)}`,
    "Risk Score": risk.score,
    "Risk Rating": RATING_LABELS[risk.rating],
    "Control Owner": [risk.control_owner_departments.join(", "), owner].filter(Boolean).join(" — "),
    "Mitigation Plans (Actions to Improve Risk Exposure)": risk.mitigation_plan || "",
    "Implementation Timeline/Responsibility": formatTimeline(risk),
    "Risk Status": STATUS_LABELS[risk.status],
  }
}

/** Excel sheet names: max 31 chars, none of : \ / ? * [ ] */
function sheetName(name: string, used: Set<string>): string {
  const base =
    name
      .replace(/[:\\/?*[\]]/g, " ")
      .slice(0, 31)
      .trim() || "Sheet"
  let candidate = base
  for (let i = 2; used.has(candidate); i++) candidate = `${base.slice(0, 28)} ${i}`
  used.add(candidate)
  return candidate
}

/** Mirrors the circulated workbook: one sheet per lead department. */
export async function exportRiskRegisterToExcel(risks: RiskRow[], ctx: RiskExportContext): Promise<void> {
  try {
    const XLSX = await import("@e965/xlsx")
    const { default: saveAs } = await import("file-saver")
    const workbook = XLSX.utils.book_new()
    const used = new Set<string>()

    const byDepartment = new Map<string, RiskRow[]>()
    for (const risk of [...risks].sort((a, b) => a.serial_no - b.serial_no)) {
      byDepartment.set(risk.department, [...(byDepartment.get(risk.department) || []), risk])
    }

    for (const [department, rows] of [...byDepartment.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const sheet = XLSX.utils.json_to_sheet(rows.map((r) => toTemplateRow(r, ctx)))
      sheet["!cols"] = [8, 12, 26, 28, 48, 36, 36, 18, 22, 10, 12, 30, 48, 30, 12].map((wch) => ({ wch }))
      XLSX.utils.book_append_sheet(workbook, sheet, sheetName(ctx.departmentCodes[department] || department, used))
    }

    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
    saveAs(
      new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `ACOB Risk Register ${toLocalISODate()}.xlsx`
    )
    toast.success("Exported to Excel")
  } catch (error) {
    log.error({ err: String(error) }, "Failed to export risk register")
    toast.error("Failed to export to Excel")
  }
}
