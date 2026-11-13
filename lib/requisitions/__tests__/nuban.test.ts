import { test } from "node:test"
import assert from "node:assert/strict"
import {
  accountNamesMatch,
  banksFittingNuban,
  checkNuban,
  isNubanValid,
  NIGERIAN_BANKS,
  nubanCheckDigit,
} from "../nuban"

const bank = (code: string) => NIGERIAN_BANKS.find((b) => b.code === code)

test("matches the CBN NUBAN worked example (First Bank 011, serial 000001457 → 9)", () => {
  assert.equal(nubanCheckDigit("011", "000001457"), 9)
  assert.equal(isNubanValid("0000014579", "011"), true)
})

test("a single mistyped digit fails", () => {
  assert.equal(isNubanValid("0000014578", "011"), false)
  assert.equal(isNubanValid("0000015579", "011"), false)
})

test("3-digit codes give the same digit whether or not they are padded to 6", () => {
  assert.equal(nubanCheckDigit("058", "012345678"), nubanCheckDigit("000058", "012345678"))
})

test("accepts legacy Diamond Bank NUBAN digits under Access Bank", () => {
  // Access Bank's current code is 044, while former Diamond accounts retain 063.
  assert.equal(isNubanValid("0107055393", "063"), true)
  assert.equal(isNubanValid("0107055393", "044"), true)
  assert.equal(checkNuban("0107055393", bank("044")).status, "valid")
})

test("rejects anything that is not 10 digits", () => {
  assert.equal(isNubanValid("000001457", "011"), false)
  assert.equal(isNubanValid("00000145790", "011"), false)
  assert.equal(isNubanValid("00000x4579", "011"), false)
})

test("checkNuban stays quiet for incomplete numbers, unknown banks and phone-number banks", () => {
  assert.deepEqual(checkNuban("00000145", bank("011")), { status: "unchecked" })
  assert.deepEqual(checkNuban("0000014578", undefined), { status: "unchecked" })
  assert.deepEqual(checkNuban("8012345678", bank("999992")), { status: "unchecked" })
})

test("checkNuban reports valid, and invalid with the banks the number would fit", () => {
  assert.equal(checkNuban("0000014579", bank("011")).status, "valid")
  const result = checkNuban("0000014579", bank("057"))
  assert.equal(result.status, "invalid")
  assert.ok(result.status === "invalid" && result.fits.some((b) => b.code === "011"))
})

test("every checked bank accepts a number built with its code", () => {
  for (const bank of NIGERIAN_BANKS.filter((b) => b.nuban)) {
    const serial = "123456789"
    const account = serial + nubanCheckDigit(bank.code, serial)
    assert.ok(
      banksFittingNuban(account).some((b) => b.code === bank.code),
      bank.name
    )
  }
})

test("bank names and codes are unique", () => {
  assert.equal(new Set(NIGERIAN_BANKS.map((b) => b.name)).size, NIGERIAN_BANKS.length)
  assert.equal(new Set(NIGERIAN_BANKS.map((b) => b.code)).size, NIGERIAN_BANKS.length)
})

test("typed names match the bank's name in any order and case", () => {
  assert.equal(accountNamesMatch("John Adebayo", "ADEBAYO JOHN OLUWASEUN"), true)
  assert.equal(accountNamesMatch("adebayo, john o.", "ADEBAYO JOHN OLUWASEUN"), true)
  assert.equal(accountNamesMatch("Chinedu Okafor", "ADEBAYO JOHN OLUWASEUN"), false)
  assert.equal(accountNamesMatch("", "ADEBAYO JOHN"), false)
})
