import assert from "node:assert/strict"
import { describe, it } from "node:test"
import JSZip from "jszip"
import * as XLSX from "@e965/xlsx"
import { buildBankWorkbookFile } from "../bank-workbook"
import { BANK_FILE_HEADERS } from "../bank-file"

const items = [
  {
    transaction_ref: "ACOB/PR/HR/26/003/1",
    account_name: "Adukwu Lawrence & Sons",
    amount: 108800,
    beneficiary_code: "ACOB-V-0001",
    account_number: "0021191633",
    bank_code: "044",
  },
]

describe("bank workbook", () => {
  it("reads back with titles on row 1 and one payment per row", async () => {
    const buffer = await buildBankWorkbookFile(items, "2026-11-10", "1015119549")
    const book = XLSX.read(buffer, { type: "buffer" })
    assert.deepEqual(book.SheetNames, ["BANK UPLOAD SCHEDULE"])
    const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets["BANK UPLOAD SCHEDULE"], { header: 1, raw: true })
    assert.equal(rows.length, 2)
    assert.equal(rows[0][0], BANK_FILE_HEADERS[0])
    assert.equal(rows[1][0], "ACOB/PR/HR/26/003/1")
    assert.equal(rows[1][1], "ADUKWU LAWRENCE & SONS")
    assert.equal(rows[1][2], "108800.00")
    assert.equal(rows[1][3], "10/11/2026")
    assert.equal(rows[1][5], "0021191633") // leading zero kept
    assert.equal(rows[1][6], 44)
    assert.equal(rows[1][7], 1015119549)
  })

  it("wraps the titles in a tall row so they can be read", async () => {
    const zip = await JSZip.loadAsync(await buildBankWorkbookFile(items, "2026-11-10", "1015119549"))
    const sheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string")
    const styles = await zip.file("xl/styles.xml")!.async("string")
    assert.match(sheet, /<row r="1" ht="\d+" customHeight="1">/)
    assert.match(styles, /wrapText="1"/)
  })
})
