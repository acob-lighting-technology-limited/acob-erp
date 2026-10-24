import { normalizeDepartmentName, CANONICAL_DEPARTMENT_ORDER } from "@/shared/departments"

export interface CbtImportParsedRow {
  department: string
  prompt: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: "A" | "B" | "C" | "D"
  explanation?: string | null
}

export interface CbtImportRowError {
  rowNumber: number
  message: string
}

export interface CbtImportResult {
  validRows: CbtImportParsedRow[]
  errors: CbtImportRowError[]
  totalRowsCount: number
  departmentsFound: string[]
}

const HEADER_ALIASES: Record<string, string[]> = {
  department: ["department", "dept", "unit", "category", "dept name", "department name"],
  prompt: ["question", "prompt", "question text", "question / prompt", "item", "question prompt"],
  option_a: ["option a", "option_a", "option 1", "choice a", "a"],
  option_b: ["option b", "option_b", "option 2", "choice b", "b"],
  option_c: ["option c", "option_c", "option 3", "choice c", "c"],
  option_d: ["option d", "option_d", "option 4", "choice d", "d"],
  correct_option: [
    "correct option",
    "correct_option",
    "correct answer",
    "correct",
    "answer",
    "key",
    "ans",
    "correct choice",
  ],
  explanation: ["explanation", "notes", "rationale", "reason"],
}

function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[_\-\/\s]+/g, " ")
}

function matchHeader(header: string): keyof typeof HEADER_ALIASES | null {
  const norm = normalizeHeader(header)
  for (const [canonicalKey, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(norm)) {
      return canonicalKey as keyof typeof HEADER_ALIASES
    }
  }
  return null
}

function parseCorrectOption(raw: unknown): "A" | "B" | "C" | "D" | null {
  if (raw === null || raw === undefined) return null
  const str = String(raw).trim().toUpperCase()
  if (str === "A" || str === "B" || str === "C" || str === "D") return str

  // Handle "Option A", "Option B", "A.", "(A)", etc.
  const match = str.match(/\b([A-D])\b/)
  if (match && (match[1] === "A" || match[1] === "B" || match[1] === "C" || match[1] === "D")) {
    return match[1]
  }

  // Handle numbers 1, 2, 3, 4
  if (str === "1") return "A"
  if (str === "2") return "B"
  if (str === "3") return "C"
  if (str === "4") return "D"

  return null
}

/**
 * Parses raw file buffer from .xlsx, .xls, or .csv into validated CBT question rows.
 */
export async function parseCbtQuestionsFile(
  fileBuffer: ArrayBuffer | Uint8Array,
  options: {
    defaultDepartment?: string
  } = {}
): Promise<CbtImportResult> {
  const XLSX = await import("@e965/xlsx")
  const workbook = XLSX.read(fileBuffer, { type: "array" })
  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    return {
      validRows: [],
      errors: [{ rowNumber: 0, message: "File contains no sheets or data." }],
      totalRowsCount: 0,
      departmentsFound: [],
    }
  }

  const worksheet = workbook.Sheets[firstSheetName]
  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, {
    defval: "",
    raw: false,
  })

  if (!rawRows || rawRows.length === 0) {
    return {
      validRows: [],
      errors: [{ rowNumber: 0, message: "The sheet is empty or contains only headers." }],
      totalRowsCount: 0,
      departmentsFound: [],
    }
  }

  // Map header keys
  const firstRow = rawRows[0] || {}
  const headerMap = new Map<string, keyof typeof HEADER_ALIASES>()
  for (const rawCol of Object.keys(firstRow)) {
    const matched = matchHeader(rawCol)
    if (matched) {
      headerMap.set(rawCol, matched)
    }
  }

  const validRows: CbtImportParsedRow[] = []
  const errors: CbtImportRowError[] = []
  const departmentsFound = new Set<string>()

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2 // 1-based index accounting for header row
    const extracted: Partial<Record<keyof typeof HEADER_ALIASES, string>> = {}

    for (const [colName, val] of Object.entries(row)) {
      const canonicalKey = headerMap.get(colName)
      if (canonicalKey && val !== undefined && val !== null) {
        extracted[canonicalKey] = String(val).trim()
      }
    }

    // Check if the entire row is blank
    const hasAnyContent = Object.values(extracted).some((v) => Boolean(v))
    if (!hasAnyContent) return

    // Department resolution
    let department = extracted.department ? normalizeDepartmentName(extracted.department) : ""
    if (!department && options.defaultDepartment) {
      department = normalizeDepartmentName(options.defaultDepartment)
    }

    if (!department) {
      errors.push({
        rowNumber,
        message: "Missing department. Please provide a Department column or select a default department.",
      })
      return
    }

    // Question / Prompt
    const prompt = extracted.prompt || ""
    if (!prompt) {
      errors.push({ rowNumber, message: "Question text / prompt is missing." })
      return
    }

    // Options A-D
    const option_a = extracted.option_a || ""
    const option_b = extracted.option_b || ""
    const option_c = extracted.option_c || ""
    const option_d = extracted.option_d || ""

    const missingOptions: string[] = []
    if (!option_a) missingOptions.push("Option A")
    if (!option_b) missingOptions.push("Option B")
    if (!option_c) missingOptions.push("Option C")
    if (!option_d) missingOptions.push("Option D")

    if (missingOptions.length > 0) {
      errors.push({
        rowNumber,
        message: `Missing ${missingOptions.join(", ")}. All 4 options are required.`,
      })
      return
    }

    // Correct Option
    const correct_option = parseCorrectOption(extracted.correct_option)
    if (!correct_option) {
      errors.push({
        rowNumber,
        message: `Invalid or missing correct option '${extracted.correct_option || ""}'. Must be A, B, C, or D.`,
      })
      return
    }

    departmentsFound.add(department)

    validRows.push({
      department,
      prompt,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      explanation: extracted.explanation || null,
    })
  })

  return {
    validRows,
    errors,
    totalRowsCount: rawRows.length,
    departmentsFound: Array.from(departmentsFound).sort((a, b) => {
      const idxA = CANONICAL_DEPARTMENT_ORDER.indexOf(a as any)
      const idxB = CANONICAL_DEPARTMENT_ORDER.indexOf(b as any)
      if (idxA !== -1 && idxB !== -1) return idxA - idxB
      return a.localeCompare(b)
    }),
  }
}
