import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { hasWorkLinkConflict, portfolioLabel } from "../work-links"

describe("hasWorkLinkConflict", () => {
  it("allows a project, a portfolio, or neither", () => {
    assert.equal(hasWorkLinkConflict("p1", null), false)
    assert.equal(hasWorkLinkConflict(null, "f1"), false)
    assert.equal(hasWorkLinkConflict("", "f1"), false)
    assert.equal(hasWorkLinkConflict(undefined, undefined), false)
  })

  it("rejects a task linked to both", () => {
    assert.equal(hasWorkLinkConflict("p1", "f1"), true)
  })
})

describe("portfolioLabel", () => {
  it("leads with the code when there is one", () => {
    assert.equal(portfolioLabel({ name: "Minimum Subsidy Tender", code: "MST" }), "MST — Minimum Subsidy Tender")
    assert.equal(portfolioLabel({ name: "Edo Cluster", code: null }), "Edo Cluster")
  })
})
