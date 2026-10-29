import test from "node:test"
import assert from "node:assert/strict"
import {
  buildAnniversarySignatureHtml,
  buildDefaultSignatureHtml,
  buildEmailContactHtml,
  buildPhoneContactHtml,
  type DefaultSignatureInput,
} from "../default-signature"

const PAYLOAD = `<img src=x onerror=alert(1)>`

const base: DefaultSignatureInput = {
  fullName: "Ada Obi",
  companyRole: "Engineer",
  phoneNumber: "08031234567",
  formattedPhone: "+234 803 123 4567",
  companyEmail: "ada@acoblighting.com",
  alternativeEmail: "",
  emailContactOrder: "main-first",
}

test("default signature escapes name and role", () => {
  const html = buildDefaultSignatureHtml({ ...base, fullName: PAYLOAD, companyRole: PAYLOAD })
  assert.ok(!html.includes(PAYLOAD))
  assert.ok(!/<img src=x/.test(html))
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"))
})

test("anniversary signature escapes name and role in every template", () => {
  for (const template of ["classic", "timeline", "heritage", "renewal", "minimal"]) {
    const html = buildAnniversarySignatureHtml({ ...base, fullName: PAYLOAD, companyRole: PAYLOAD }, { template })
    assert.ok(!html.includes(PAYLOAD), template)
    assert.ok(!/<img src=x/.test(html), template)
  }
})

test("phone href keeps only digits and +, and the label is escaped", () => {
  const html = buildPhoneContactHtml(`0803" onmouseover="alert(1)`, `<b>x</b>`)
  // the quote, spaces and letters are dropped, leaving digits only (0803 + the 1 from alert(1))
  assert.ok(html.includes(`href="tel:08031"`))
  assert.ok(!html.includes("onmouseover"))
  assert.ok(html.includes("&lt;b&gt;x&lt;/b&gt;"))
})

test("email addresses cannot break out of the href attribute", () => {
  const html = buildEmailContactHtml(`a@b.com" onclick="alert(1)`, `c@d.com"><script>x</script>`, "main-first")
  assert.ok(!html.includes(`" onclick="`))
  assert.ok(!html.includes("<script>"))
})

test("ordinary values are unchanged apart from entities", () => {
  const html = buildDefaultSignatureHtml(base)
  assert.ok(html.includes("Ada Obi"))
  assert.ok(html.includes("Engineer"))
  assert.ok(html.includes('href="tel:08031234567"'))
  assert.ok(html.includes('href="mailto:ada@acoblighting.com"'))
})

test("names with ampersands render as entities, not markup", () => {
  const html = buildDefaultSignatureHtml({ ...base, fullName: "Ada & Sons" })
  assert.ok(html.includes("Ada &amp; Sons"))
})
