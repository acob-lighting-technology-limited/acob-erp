import * as XLSX from "@e965/xlsx"
import { toLocalISODate } from "@/lib/utils/date"
import { CreateRiskSchema, type CreateRiskInput } from "./model"

const MAX_IMPORT_ROWS = 200

export interface RiskImportWarning {
  code: "department_normalized" | "owner_review" | "timeline_review" | "status_normalized"
  message: string
}

export interface RiskImportPreviewRow {
  sourceSheet: string
  sourceRow: number
  sourceSerial: string
  risk: CreateRiskInput
  warnings: RiskImportWarning[]
  duplicate: boolean
}

export interface RiskImportPreview {
  fileName: string
  rows: RiskImportPreviewRow[]
  errors: string[]
}

export const RiskImportBatchSchema = CreateRiskSchema.array().min(1).max(MAX_IMPORT_ROWS)

type CellValue = string | number | boolean | Date | null | undefined

const HEADER_ALIASES: Record<string, string[]> = {
  serial: ["risk sn", "sn", "serial no", "serial number"],
  department: ["risk category", "department or unit", "risk category department or unit"],
  riskName: ["risk name"],
  description: ["risk description"],
  causes: ["causes"],
  consequence: ["potential impact consequence", "potential impact", "consequence"],
  impact: ["inherent impact"],
  likelihood: ["inherent likelihood"],
  owner: ["control owner"],
  mitigation: ["mitigation plans", "mitigation plan"],
  timeline: ["implementation timeline responsibility", "implementation timeline"],
  status: ["risk status", "status"],
}

const DEPARTMENT_ALIASES: Record<string, string> = {
  account: "Accounts",
  accounts: "Accounts",
  admin: "Admin and HR",
  "admin hr": "Admin and HR",
  "admin and hr": "Admin and HR",
  hr: "Admin and HR",
  bgi: "Business, Growth and Innovation",
  "business growth and innovation": "Business, Growth and Innovation",
  "corporate services": "Corporate Services",
  facilities: "Corporate Services",
  management: "Executive Management",
  "senior management": "Executive Management",
  "executive management": "Executive Management",
  it: "IT and Communications",
  "it and communications": "IT and Communications",
  operations: "Operations and Maintenance",
  "operations and maintenance": "Operations and Maintenance",
  project: "Project",
  compliance: "Regulatory and Compliance",
  "regulatory and compliance": "Regulatory and Compliance",
  technical: "Technical",
  tech: "Technical",
}

function normalizedText(value: CellValue): string {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function text(value: CellValue): string {
  return String(value ?? "").trim()
}

function headerIndex(row: CellValue[], aliases: string[]): number {
  return row.findIndex((cell) => {
    const header = normalizedText(cell)
    return aliases.some((alias) => header === alias || header.startsWith(`${alias} `))
  })
}

function canonicalDepartment(value: string): string | null {
  const normalized = normalizedText(value)
  return DEPARTMENT_ALIASES[normalized] ?? null
}

function splitDepartments(value: string): string[] {
  const normalized = normalizedText(value)
  if (normalized === "hr admin" || normalized === "admin hr") return ["Admin and HR"]

  const matches = new Set<string>()
  for (const [alias, canonical] of Object.entries(DEPARTMENT_ALIASES).sort(([a], [b]) => b.length - a.length)) {
    if (new RegExp(`(^|\\b)${alias.replace(/ /g, "\\s+")}(\\b|$)`, "i").test(normalized)) matches.add(canonical)
  }
  return [...matches]
}

function numericLevel(value: CellValue): number | null {
  const match = text(value).match(/[1-5]/)
  return match ? Number(match[0]) : null
}

function statusValue(value: CellValue, warnings: RiskImportWarning[]): "open" | "in_progress" | "closed" {
  const normalized = normalizedText(value)
  if (normalized === "closed" || normalized === "complete" || normalized === "completed") return "closed"
  if (normalized === "in progress" || normalized === "ongoing") return "in_progress"
  if (normalized && normalized !== "open") {
    warnings.push({ code: "status_normalized", message: `Risk status “${text(value)}” was imported as Open.` })
  }
  return "open"
}

function excelDate(value: CellValue): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return toLocalISODate(value)
  const raw = text(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
}

function parseSheet(sheetName: string, sheet: XLSX.WorkSheet): { rows: RiskImportPreviewRow[]; errors: string[] } {
  const values = XLSX.utils.sheet_to_json<CellValue[]>(sheet, { header: 1, raw: true, defval: "" })
  const headerRowIndex = values.findIndex((row) => headerIndex(row, HEADER_ALIASES.riskName) >= 0)
  if (headerRowIndex < 0) return { rows: [], errors: [`${sheetName}: no risk-register header row was found.`] }

  const header = values[headerRowIndex]
  const columns = Object.fromEntries(
    Object.entries(HEADER_ALIASES).map(([key, aliases]) => [key, headerIndex(header, aliases)])
  ) as Record<keyof typeof HEADER_ALIASES, number>
  const required = ["department", "riskName", "description", "impact", "likelihood", "owner"] as const
  const missing = required.filter((key) => columns[key] < 0)
  if (missing.length > 0) return { rows: [], errors: [`${sheetName}: missing columns: ${missing.join(", ")}.`] }

  const rows: RiskImportPreviewRow[] = []
  const errors: string[] = []
  for (let index = headerRowIndex + 1; index < values.length; index++) {
    const row = values[index]
    const riskName = text(row[columns.riskName])
    if (!riskName) continue
    // The circulated template places field guidance directly below its header.
    if (
      normalizedText(riskName).startsWith("short name") ||
      normalizedText(row[columns.department]) === "department or unit"
    ) {
      continue
    }

    const sourceRow = index + 1
    const warnings: RiskImportWarning[] = []
    const rawDepartment = text(row[columns.department])
    const involved = splitDepartments(rawDepartment)
    const department = involved[0] ?? canonicalDepartment(sheetName)
    if (!department) {
      errors.push(`${sheetName} row ${sourceRow}: department “${rawDepartment || sheetName}” is not recognised.`)
      continue
    }
    if (normalizedText(rawDepartment) !== normalizedText(department)) {
      warnings.push({ code: "department_normalized", message: `Department “${rawDepartment}” maps to ${department}.` })
    }

    const ownerText = text(row[columns.owner])
    const ownerDepartments = splitDepartments(ownerText)
    if (ownerDepartments.length === 0) ownerDepartments.push(department)
    if (ownerText && normalizedText(ownerText) !== normalizedText(ownerDepartments.join(" "))) {
      warnings.push({ code: "owner_review", message: `Preserved role-based owner wording: “${ownerText}”.` })
    }

    const timelineText = columns.timeline >= 0 ? text(row[columns.timeline]) : ""
    const targetDate = columns.timeline >= 0 ? excelDate(row[columns.timeline]) : null
    if (timelineText && !targetDate) {
      warnings.push({
        code: "timeline_review",
        message: `“${timelineText}” is preserved as a continuous timeline note.`,
      })
    }

    const impact = numericLevel(row[columns.impact])
    const likelihood = numericLevel(row[columns.likelihood])
    const candidate = {
      department,
      supporting_departments: involved.slice(1).filter((item) => item !== department),
      risk_name: riskName,
      description: text(row[columns.description]),
      causes: columns.causes >= 0 ? text(row[columns.causes]) || null : null,
      consequence: columns.consequence >= 0 ? text(row[columns.consequence]) || null : null,
      impact,
      likelihood,
      control_owner_departments: ownerDepartments,
      control_owner_id: null,
      control_owner_note: ownerText || null,
      mitigation_plan: columns.mitigation >= 0 ? text(row[columns.mitigation]) || null : null,
      timeline_type: targetDate ? ("by_date" as const) : ("continuous" as const),
      target_date: targetDate,
      timeline_note: timelineText || null,
      status: columns.status >= 0 ? statusValue(row[columns.status], warnings) : ("open" as const),
    }
    const parsed = CreateRiskSchema.safeParse(candidate)
    if (!parsed.success) {
      errors.push(`${sheetName} row ${sourceRow}: ${parsed.error.issues[0]?.message || "invalid risk data"}.`)
      continue
    }

    rows.push({
      sourceSheet: sheetName,
      sourceRow,
      sourceSerial: columns.serial >= 0 ? text(row[columns.serial]) : "",
      risk: parsed.data,
      warnings,
      duplicate: false,
    })
  }
  return { rows, errors }
}

export function parseRiskRegisterWorkbook(bytes: Uint8Array, fileName: string): RiskImportPreview {
  const workbook = XLSX.read(bytes, { type: "array", cellDates: true })
  const rows: RiskImportPreviewRow[] = []
  const errors: string[] = []
  for (const sheetName of workbook.SheetNames) {
    const parsed = parseSheet(sheetName, workbook.Sheets[sheetName])
    rows.push(...parsed.rows)
    errors.push(...parsed.errors)
  }
  if (rows.length > MAX_IMPORT_ROWS)
    errors.push(`The workbook has ${rows.length} risks; the limit is ${MAX_IMPORT_ROWS}.`)
  if (rows.length === 0 && errors.length === 0) errors.push("The workbook contains no risk rows.")
  return { fileName, rows: rows.slice(0, MAX_IMPORT_ROWS), errors }
}

export function markDuplicateRisks(
  preview: RiskImportPreview,
  existing: Array<{ department: string; risk_name: string }>
): RiskImportPreview {
  const keys = new Set(
    existing.map((risk) => `${normalizedText(risk.department)}\u0000${normalizedText(risk.risk_name)}`)
  )
  const seen = new Set<string>()
  return {
    ...preview,
    rows: preview.rows.map((row) => {
      const key = `${normalizedText(row.risk.department)}\u0000${normalizedText(row.risk.risk_name)}`
      const duplicate = keys.has(key) || seen.has(key)
      seen.add(key)
      return { ...row, duplicate }
    }),
  }
}
