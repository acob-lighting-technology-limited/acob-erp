import { test } from "node:test"
import assert from "node:assert/strict"
import { DEFAULT_STARLINK_ALERTS, normalizeAlertsConfig, renderStarlinkAlertEmail } from "../billing-alerts"

test("missing or malformed settings fall back to alerts off", () => {
  assert.deepEqual(normalizeAlertsConfig(null), DEFAULT_STARLINK_ALERTS)
  assert.deepEqual(normalizeAlertsConfig({ due: { daysBefore: 99, recipientUserIds: "x" } }), DEFAULT_STARLINK_ALERTS)
})

test("keeps valid recipients and days", () => {
  const config = normalizeAlertsConfig({
    failed: { enabled: true, recipientUserIds: ["a", 3, "b"] },
    due: { enabled: true, recipientUserIds: ["c"], daysBefore: 0 },
  })
  assert.deepEqual(config, {
    failed: { enabled: true, recipientUserIds: ["a", "b"] },
    due: { enabled: true, recipientUserIds: ["c"], daysBefore: 0 },
  })
})

test("alert email uses the dark-mode-locked shell and escapes values", () => {
  const html = renderStarlinkAlertEmail({
    recipientName: "Ada <script>",
    heading: "Starlink Payment Failed",
    intro: "x",
    rows: [["Kit", "Oloyan & Co"]],
    actionUrl: "https://matrix.acoblighting.com/admin/accounts/payments/1",
  })
  assert.equal((html.match(/linear-gradient\(#000000,#000000\) !important/g) || []).length, 4)
  assert.ok(html.includes("Ada &lt;script&gt;"))
  assert.ok(html.includes("Oloyan &amp; Co"))
})
