import { test } from "node:test"
import assert from "node:assert/strict"
import { addOneMonthISO, classifyStarlinkMail, htmlToText, parseStarlinkMail } from "../billing-mail"

// Text as it arrives in the ict mailbox (account numbers are real kit accounts).
const REMINDER = `[Starlink]
Payment Scheduled
Your monthly service bill is scheduled for automatic payment on 1/11/2026.
Statement Period Current Balance
1/11/2026 - 2/10/2026 NGN 57,000.00
Sign in to your account below to review your payment or update your payment method.
This message was sent to adebayo@org.acoblighting.com for account ACC-3038459-10152-6.`

const PROCESSED = `INV-DF-NGA-1693430-53376-95
[Starlink]
Payment Processed
The following payment has processed.
Amount NGN 57,000.00
Account ACC-DF-10224272-87960-46
Invoice INV-DF-NGA-1693430-53376-95
This message was sent to oloyan@org.acoblighting.com for account ACC-DF-10224272-87960-46.`

const FAILED = `Take action to avoid interruption to your Starlink service.
[Starlink]
Payment Failed
Account Number ACC-3038459-10152-6
Payment Amount NGN 57,000.00
Your payment failed because the payment amount was over the available limit.`

test("classifies billing subjects and ignores the rest", () => {
  assert.equal(classifyStarlinkMail("Automatic Payment Reminder"), "reminder")
  assert.equal(classifyStarlinkMail(" Payment Processed "), "processed")
  assert.equal(classifyStarlinkMail("Starlink Payment Failed"), "failed")
  assert.equal(classifyStarlinkMail("Your Starlink verification code"), null)
  assert.equal(classifyStarlinkMail(undefined), null)
})

test("reads a reminder's US-format period, amount and invoice from the PDF name", () => {
  const parsed = parseStarlinkMail("reminder", REMINDER, ["INV-DF-NGA-1716297-27386-4.pdf"])
  assert.equal(parsed.accountNumber, "ACC-3038459-10152-6")
  assert.equal(parsed.periodStart, "2026-01-11")
  assert.equal(parsed.periodEnd, "2026-02-10")
  assert.equal(parsed.amount, 57000)
  assert.equal(parsed.currency, "NGN")
  assert.equal(parsed.invoiceNumber, "INV-DF-NGA-1716297-27386-4")
})

test("reads a processed payment's invoice, amount and account", () => {
  const parsed = parseStarlinkMail("processed", PROCESSED)
  assert.equal(parsed.accountNumber, "ACC-DF-10224272-87960-46")
  assert.equal(parsed.invoiceNumber, "INV-DF-NGA-1693430-53376-95")
  assert.equal(parsed.amount, 57000)
  assert.equal(parsed.periodStart, null)
})

test("reads a failed payment's account and amount", () => {
  const parsed = parseStarlinkMail("failed", FAILED)
  assert.equal(parsed.accountNumber, "ACC-3038459-10152-6")
  assert.equal(parsed.amount, 57000)
})

test("flattens HTML bodies", () => {
  const text = htmlToText("<p>Amount&nbsp;NGN 57,000.00</p><div>Account ACC-DF-1-2</div><style>x{}</style>")
  assert.equal(text, "Amount NGN 57,000.00\nAccount ACC-DF-1-2")
})

test("adds a month, clamping to the last day", () => {
  assert.equal(addOneMonthISO("2026-04-03"), "2026-05-03")
  assert.equal(addOneMonthISO("2026-12-22"), "2027-01-22")
  assert.equal(addOneMonthISO("2026-01-31"), "2026-02-28")
})
