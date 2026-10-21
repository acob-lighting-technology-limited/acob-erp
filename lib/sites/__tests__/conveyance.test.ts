import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { conveyanceStanding, documentName, documentStanding, EXPIRY_WARNING_DAYS } from "../conveyance"

const TODAY = "2026-10-21"

describe("documentStanding", () => {
  it("is pending or not required regardless of dates", () => {
    assert.equal(
      documentStanding({ document_type: "mou", status: "pending", expires_on: "2020-01-01" }, TODAY),
      "pending"
    )
    assert.equal(
      documentStanding({ document_type: "mou", status: "not_required", expires_on: "2020-01-01" }, TODAY),
      "not_required"
    )
  })

  it("treats an obtained document with no expiry as valid", () => {
    assert.equal(documentStanding({ document_type: "mou", status: "obtained", expires_on: null }, TODAY), "valid")
  })

  it("is valid through its expiry date and expired the day after", () => {
    assert.equal(documentStanding({ document_type: "nerc", status: "obtained", expires_on: TODAY }, TODAY), "expiring")
    assert.equal(
      documentStanding({ document_type: "nerc", status: "obtained", expires_on: "2026-10-20" }, TODAY),
      "expired"
    )
  })

  it("flags documents inside the warning window", () => {
    // 2026-10-21 + 60 days is the last day of the warning window.
    assert.equal(EXPIRY_WARNING_DAYS, 60)
    const edge = "2026-12-20"
    const past = "2026-12-21"
    assert.equal(documentStanding({ document_type: "nemsa", status: "obtained", expires_on: edge }, TODAY), "expiring")
    assert.equal(documentStanding({ document_type: "nemsa", status: "obtained", expires_on: past }, TODAY), "valid")
  })
})

describe("conveyanceStanding", () => {
  it("is 'none' with nothing recorded, or only not-required documents", () => {
    assert.equal(conveyanceStanding([], TODAY), "none")
    assert.equal(conveyanceStanding([{ document_type: "nerc", status: "not_required" }], TODAY), "none")
  })

  it("reports the worst document", () => {
    assert.equal(
      conveyanceStanding(
        [
          { document_type: "exclusivity", status: "obtained", expires_on: "2030-01-01" },
          { document_type: "mou", status: "pending" },
          { document_type: "nerc", status: "obtained", expires_on: "2026-01-01" },
        ],
        TODAY
      ),
      "expired"
    )
    assert.equal(
      conveyanceStanding(
        [
          { document_type: "exclusivity", status: "obtained", expires_on: "2030-01-01" },
          { document_type: "mou", status: "pending" },
        ],
        TODAY
      ),
      "pending"
    )
  })
})

describe("documentName", () => {
  it("uses the label only for other documents", () => {
    assert.equal(documentName({ document_type: "mou", label: "ignored" }), "MOU")
    assert.equal(documentName({ document_type: "other", label: " Land Agreement " }), "Land Agreement")
    assert.equal(documentName({ document_type: "other", label: null }), "Other")
  })
})
