import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { isActiveChild } from "../navigation/active-child"

const SIBLINGS = [{ href: "/portfolios" }, { href: "/projects" }, { href: "/portfolios/sites" }]

describe("isActiveChild", () => {
  it("highlights only the most specific sibling", () => {
    assert.equal(isActiveChild("/portfolios/sites", "/portfolios/sites", SIBLINGS), true)
    assert.equal(isActiveChild("/portfolios/sites", "/portfolios", SIBLINGS), false)
  })

  it("keeps the parent active for its own sub-pages", () => {
    assert.equal(isActiveChild("/portfolios/1234", "/portfolios", SIBLINGS), true)
    assert.equal(isActiveChild("/portfolios", "/portfolios", SIBLINGS), true)
  })

  it("does not match on a shared prefix that is not a path segment", () => {
    assert.equal(isActiveChild("/portfolios-old", "/portfolios", SIBLINGS), false)
    assert.equal(isActiveChild(null, "/portfolios", SIBLINGS), false)
  })
})
