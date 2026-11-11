import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { cleanAmountInput, lineItemsTotal, parseNaira } from "../limits"

describe("parseNaira", () => {
  it("reads pasted amounts with separators and symbols", () => {
    assert.equal(parseNaira("1,200,000"), 1200000)
    assert.equal(parseNaira("₦50,000.00"), 50000)
    assert.equal(parseNaira("NGN 3 500"), 3500)
    assert.equal(parseNaira(" 48,600 "), 48600)
    assert.equal(parseNaira("1200.5"), 1200.5)
  })

  it("reads nothing as zero rather than NaN", () => {
    assert.equal(parseNaira(""), 0)
    assert.equal(parseNaira("abc"), 0)
    assert.equal(parseNaira("1.200.000"), 0)
    assert.equal(parseNaira(undefined), 0)
    assert.equal(parseNaira(Number.NaN), 0)
  })

  it("passes numbers through", () => {
    assert.equal(parseNaira(2500), 2500)
  })
})

describe("cleanAmountInput", () => {
  it("cleans what lands in the box", () => {
    assert.equal(cleanAmountInput("1,200,000"), "1200000")
    assert.equal(cleanAmountInput("₦50,000.00"), "50000.00")
    assert.equal(cleanAmountInput("12.345"), "12.34")
    assert.equal(cleanAmountInput("1.2.3"), "1.23")
    assert.equal(cleanAmountInput("abc"), "")
  })
})

describe("lineItemsTotal", () => {
  it("adds pasted text amounts too", () => {
    assert.equal(lineItemsTotal([{ amount: "1,000" }, { amount: "2,500.50" }]), 3500.5)
  })
})
