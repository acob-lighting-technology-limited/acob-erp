import test from "node:test"
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { StatGrid } from "../stat-grid"
import { StatCard } from "../stat-card"

const card = (title: string, value: string | number) => createElement(StatCard, { key: title, title, value })
const render = (...children: Parameters<typeof createElement>[2][]) =>
  renderToStaticMarkup(createElement(StatGrid, null, ...children))

test("stat cards become a one-line summary on a phone, and the cards stay from sm up", () => {
  const out = render(card("Staff", 12), card("Pending", 3), card("Overdue", 1), card("Open", 7))
  assert.match(out, /<ul[^>]*aria-label="Summary"[^>]*sm:hidden/)
  for (const [title, value] of [
    ["Staff", "12"],
    ["Pending", "3"],
    ["Overdue", "1"],
    ["Open", "7"],
  ]) {
    assert.match(out, new RegExp(`<span[^>]*>${value}</span><span>${title}</span>`), title)
  }
  // the cards are in the markup too, in a grid that only shows from sm
  assert.match(out, /class="hidden gap-3 sm:grid sm:grid-cols-4"/)
  assert.equal((out.match(/Staff/g) || []).length, 2)
})

test("every metric is in the line, not just the first three", () => {
  const out = render(...["A", "B", "C", "D", "E", "F"].map((t, i) => card(t, i)))
  assert.equal((out.match(/<li\b/g) || []).length, 6)
})

test("a value of zero is shown", () => {
  assert.match(render(card("Overdue", 0)), /<span[^>]*>0<\/span><span>Overdue<\/span>/)
})

test("children that are not stat cards keep the older grid, with no summary line", () => {
  const custom = createElement("div", { key: "x" }, "custom tile")
  const out = render(card("Staff", 12), custom)
  assert.doesNotMatch(out, /aria-label="Summary"/)
  assert.match(out, /grid-cols-2/)
})

test("an empty grid renders nothing", () => {
  assert.equal(renderToStaticMarkup(createElement(StatGrid, null, null, false)), "")
})
