import { test } from "node:test"
import assert from "node:assert/strict"
import { toCsv } from "../csv"
import { getTableExportData } from "../table-export"

test("CSV includes one UTF-8 BOM, CRLF records and RFC 4180 escaping", () => {
  assert.equal(
    toCsv([
      ["Name", "Cost"],
      ['A, "B"', "₦10\r\n20"],
    ]),
    '\uFEFFName,Cost\r\n"A, ""B""","₦10\r\n20"'
  )
})
test("CSV neutralizes formulas including formulas hidden by whitespace, phone numbers, and malicious strings", () => {
  assert.equal(
    toCsv([["=1+1", "=SUM(A1)", "+SUM(A1)", "-1+cmd|calc", "@cmd", "\t=1", "+234 803 123 4567", "safe"]]),
    "\uFEFF'=1+1,'=SUM(A1),'+SUM(A1),'-1+cmd|calc,'@cmd,'\t=1,'+234 803 123 4567,safe"
  )
})
test("CSV preserves negative numbers and decimal strings without prepending quote", () => {
  assert.equal(toCsv([[-5, "-12.5", -0.75, "+42", 0, false, ""]]), "\uFEFF-5,-12.5,-0.75,+42,0,false,")
})
test("CSV preserves zeros and booleans and normalizes nullable cells", () => {
  assert.equal(toCsv([[null, undefined, 0, false, ""]]), "\uFEFF,,0,false,")
  assert.equal(toCsv([]), "\uFEFF")
})
test("table export preserves supplied column and row order and skips render-only columns", () => {
  assert.deepEqual(
    getTableExportData(
      [
        { name: "B", cost: null },
        { name: "A", cost: 0 },
      ],
      [{ label: "Actions" }, { label: "Cost", accessor: (r) => r.cost }, { label: "Name", accessor: (r) => r.name }]
    ),
    {
      headers: ["Cost", "Name"],
      rows: [
        ["", "B"],
        [0, "A"],
      ],
    }
  )
})
