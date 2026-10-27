import test from "node:test"
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { DetailList, SectionHeading } from "../detail-list"

const html = (items: Parameters<typeof DetailList>[0]["items"]) =>
  renderToStaticMarkup(createElement(DetailList, { items }))

test("renders each item as a term and a description", () => {
  const out = html([
    { label: "Reliever", value: "Ada Obi" },
    { label: "Resume date", value: "2 Nov 2026" },
  ])
  assert.match(out, /<dl\b/)
  assert.match(out, /<dt[^>]*>Reliever<\/dt><dd[^>]*>Ada Obi<\/dd>/)
  assert.match(out, /<dt[^>]*>Resume date<\/dt><dd[^>]*>2 Nov 2026<\/dd>/)
})

test("an empty value shows an em dash, in a muted colour", () => {
  for (const empty of [null, undefined, "", false]) {
    const out = html([{ label: "Lead", value: empty }])
    assert.match(out, /<dd[^>]*text-muted-foreground[^>]*>—<\/dd>/, String(empty))
  }
})

test("zero is a value, not an empty one", () => {
  assert.match(html([{ label: "Days", value: 0 }]), /<dd[^>]*>0<\/dd>/)
})

test("a wide item spans the row", () => {
  const out = html([
    { label: "Reason", value: "Long text", wide: true },
    { label: "Plain", value: "x" },
  ])
  const [wide, plain] = out.split("</div><div")
  assert.match(wide, /col-span-full/)
  assert.doesNotMatch(plain, /col-span-full/)
})

test("never uses text smaller than text-xs", () => {
  const out = html([{ label: "A", value: "b" }]) + renderToStaticMarkup(createElement(SectionHeading, { title: "T" }))
  assert.doesNotMatch(out, /text-\[(9|10|11)px\]/)
})

test("SectionHeading shows a string aside as muted text and passes other nodes through", () => {
  const withString = renderToStaticMarkup(createElement(SectionHeading, { title: "Stages", aside: "2 of 3" }))
  assert.match(withString, /<h3[^>]*>Stages<\/h3>/)
  assert.match(withString, /<span[^>]*text-muted-foreground[^>]*>2 of 3<\/span>/)
  const withNode = renderToStaticMarkup(
    createElement(SectionHeading, { title: "Files", aside: createElement("em", null, "badge") })
  )
  assert.match(withNode, /<em>badge<\/em>/)
})
