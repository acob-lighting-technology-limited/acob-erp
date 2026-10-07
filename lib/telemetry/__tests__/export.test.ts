import test from "node:test"
import assert from "node:assert/strict"
import { neutralizeFormula } from "../export"

test("exported cells that Excel would run as formulas are kept as text", () => {
  for (const value of ['=HYPERLINK("http://x")', "+1+1", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd"]) {
    assert.equal(neutralizeFormula(value), `'${value}`)
  }
  assert.equal(neutralizeFormula("GET /api/tasks failed (500)"), "GET /api/tasks failed (500)")
  assert.equal(neutralizeFormula(3), 3)
})
