import test from "node:test"
import assert from "node:assert/strict"
import * as XLSX from "@e965/xlsx"
import { parseCbtQuestionsFile } from "../import"

test("parses multi-department questions from excel buffer", async () => {
  const rows = [
    {
      Department: "Technical",
      Question: "What is the core objective of an energy audit?",
      "Option A": "Sizing",
      "Option B": "Viability analysis",
      "Option C": "Marketing",
      "Option D": "None",
      "Correct Option": "B",
    },
    {
      Department: "Accounts",
      Question: "What is standard cap-ex treatment?",
      "Option A": "PPE",
      "Option B": "Expense",
      "Option C": "Liability",
      "Option D": "Ignore",
      "Correct Option": "Option A",
    },
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1")
  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" })

  const result = await parseCbtQuestionsFile(buffer)
  assert.equal(result.errors.length, 0)
  assert.equal(result.validRows.length, 2)
  assert.equal(result.validRows[0].department, "Technical")
  assert.equal(result.validRows[0].correct_option, "B")
  assert.equal(result.validRows[1].department, "Accounts")
  assert.equal(result.validRows[1].correct_option, "A")
  assert.deepEqual(result.departmentsFound, ["Accounts", "Technical"])
})

test("applies default department when department column is omitted", async () => {
  const rows = [
    {
      Question: "What protocol applies to roof installation?",
      "Option A": "Safety Policy",
      "Option B": "Marketing Code",
      "Option C": "Leave Rule",
      "Option D": "None",
      "Correct Option": "A",
    },
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1")
  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" })

  const result = await parseCbtQuestionsFile(buffer, { defaultDepartment: "Admin and HR" })
  assert.equal(result.errors.length, 0)
  assert.equal(result.validRows.length, 1)
  assert.equal(result.validRows[0].department, "Admin and HR")
  assert.equal(result.validRows[0].correct_option, "A")
})

test("reports row error for invalid correct option", async () => {
  const rows = [
    {
      Department: "Technical",
      Question: "Some valid question?",
      "Option A": "Choice 1",
      "Option B": "Choice 2",
      "Option C": "Choice 3",
      "Option D": "Choice 4",
      "Correct Option": "Z", // invalid!
    },
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1")
  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" })

  const result = await parseCbtQuestionsFile(buffer)
  assert.equal(result.validRows.length, 0)
  assert.equal(result.errors.length, 1)
  assert.match(result.errors[0].message, /Invalid or missing correct option 'Z'/)
})

test("parses CSV buffer with commas in question text", async () => {
  const csvContent = [
    "Department,Question,Option A,Option B,Option C,Option D,Correct Option",
    '"Technical","Which preliminary steps, specifically in solar PV design, are required?","Step 1","Step 2","Step 3","Step 4","B"',
  ].join("\n")

  const buffer = Buffer.from(csvContent, "utf8")
  const result = await parseCbtQuestionsFile(buffer)
  assert.equal(result.errors.length, 0)
  assert.equal(result.validRows.length, 1)
  assert.equal(result.validRows[0].department, "Technical")
  assert.equal(result.validRows[0].correct_option, "B")
  assert.equal(result.validRows[0].prompt, "Which preliminary steps, specifically in solar PV design, are required?")
})
