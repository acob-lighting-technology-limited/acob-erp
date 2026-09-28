import { strict as assert } from "node:assert"
import { test } from "node:test"
import * as XLSX from "@e965/xlsx"
import { markDuplicateRisks, parseRiskRegisterWorkbook } from "../import"

function workbookBytes(rows: Array<Array<string | number>>): Uint8Array {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "HR Admin")
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as Uint8Array
}

const HEADERS = [
  "Risk S/N",
  "Risk Category/ Department or Unit",
  "Risk Name",
  "Risk Description",
  "Causes",
  "Potential Impact/Consequence",
  "Inherent Impact",
  "Inherent Likelihood",
  "Control Owner",
  "Mitigation Plans",
  "Implementation Timeline/Responsibility",
  "Risk Status",
]

test("imports the ACOB HR template without inventing dates or losing owner wording", () => {
  const preview = parseRiskRegisterWorkbook(
    workbookBytes([
      HEADERS,
      [
        "",
        "Department or Unit",
        "Short name (in the negative)",
        "Summary description",
        "",
        "",
        "1 - Insignificant",
        "1 - Rare",
        "The person or office",
        "",
        "The time to complete",
        "",
      ],
      [
        1,
        "HR/ADMIN",
        "Inadequate workforce planning",
        "Workforce requirements may not be forecast.",
        "Limited planning",
        "Reduced productivity",
        4,
        4,
        "HR, HODs and Senior Management",
        "Conduct quarterly manpower reviews.",
        "Annual plan / Quarterly review / HR & HODs",
        "Open",
      ],
    ]),
    "ACOB_HR_Risk_Register.xlsx"
  )

  assert.deepEqual(preview.errors, [])
  assert.equal(preview.rows.length, 1)
  const risk = preview.rows[0].risk
  assert.equal(risk.department, "Admin and HR")
  assert.deepEqual(risk.control_owner_departments, ["Executive Management", "Admin and HR"])
  assert.equal(risk.control_owner_note, "HR, HODs and Senior Management")
  assert.equal(risk.timeline_type, "continuous")
  assert.equal(risk.target_date, null)
  assert.equal(risk.timeline_note, "Annual plan / Quarterly review / HR & HODs")
  assert.equal(risk.status, "open")
})

test("marks existing and within-workbook duplicate department risk names", () => {
  const preview = parseRiskRegisterWorkbook(
    workbookBytes([
      HEADERS,
      [1, "HR/ADMIN", "Payroll error", "First", "", "", 5, 3, "HR and Account", "Review", "Monthly", "Open"],
      [2, "HR/ADMIN", " payroll ERROR ", "Second", "", "", 4, 3, "HR", "Review", "Monthly", "Open"],
    ]),
    "risks.xlsx"
  )
  const marked = markDuplicateRisks(preview, [
    { department: "Admin and HR", risk_name: "Inadequate workforce planning" },
  ])
  assert.equal(marked.rows[0].duplicate, false)
  assert.equal(marked.rows[1].duplicate, true)
})

test("reports missing required columns instead of guessing", () => {
  const preview = parseRiskRegisterWorkbook(
    workbookBytes([
      ["Risk Name", "Risk Description"],
      ["A risk", "Description"],
    ]),
    "bad.xlsx"
  )
  assert.equal(preview.rows.length, 0)
  assert.match(preview.errors[0], /missing columns/)
})
