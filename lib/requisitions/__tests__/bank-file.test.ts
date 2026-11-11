import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { bankCodeForName, bankDate, bankFileRows, BANK_FILE_HEADERS } from "../bank-file"

describe("bank file", () => {
  it("has the bank template's eight columns in order", () => {
    assert.equal(BANK_FILE_HEADERS.length, 8)
    assert.match(BANK_FILE_HEADERS[0], /^TRANSACTION REFERENCE NUMBER/)
    assert.match(BANK_FILE_HEADERS[6], /^BENEFICIARY BANK SORT CODE/)
    assert.match(BANK_FILE_HEADERS[7], /^DEBIT ACCOUNT NUMBER/)
  })

  it("keeps account numbers as text and writes the sort code as the sheet does", () => {
    const [row] = bankFileRows(
      [
        {
          transaction_ref: "PR/HR/26/003/1",
          account_name: "Adukwu Lawrence",
          amount: 108800,
          beneficiary_code: "ACOB-V-0001",
          account_number: "0021191633",
          bank_code: "044",
        },
      ],
      "2026-11-09",
      "1015119549"
    )
    assert.equal(row.accountNumber, "0021191633")
    assert.equal(row.sortCode, 44)
    assert.equal(row.name, "ADUKWU LAWRENCE")
    assert.equal(row.amount, 108800)
    assert.equal(row.debitAccount, "1015119549")
  })

  it("writes the due date as DD/MM/YYYY", () => {
    assert.equal(bankDate("2026-11-09"), "09/11/2026")
  })
})

describe("bankCodeForName", () => {
  it("reads the bank names people typed before banks were picked from a list", () => {
    assert.equal(bankCodeForName("ACCESS"), "044")
    assert.equal(bankCodeForName("Zenith Bank"), "057")
    assert.equal(bankCodeForName("ECO"), "050")
    assert.equal(bankCodeForName("WEMA"), "035")
    assert.equal(bankCodeForName("GTB"), "058")
    assert.equal(bankCodeForName("UBA"), "033")
  })

  it("gives up rather than guess", () => {
    assert.equal(bankCodeForName(""), null)
    assert.equal(bankCodeForName("Some Bank"), null)
  })
})
