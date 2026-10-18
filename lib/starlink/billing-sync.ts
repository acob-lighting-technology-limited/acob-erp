import type { SupabaseClient } from "@supabase/supabase-js"
import { graphGet } from "@/lib/graph/client"
import { logger } from "@/lib/logger"
import { getOneDriveService } from "@/lib/onedrive"
import { buildPaymentDocumentFolderPathByType, buildPaymentDocumentPath } from "@/lib/payments/document-storage"
import {
  STARLINK_SENDER,
  classifyStarlinkMail,
  htmlToText,
  parseStarlinkMail,
  type ParsedStarlinkMail,
  type StarlinkMailKind,
} from "@/lib/starlink/billing-mail"
import { reconcileStarlinkSchedule, type BillingEventForSchedule } from "@/lib/starlink/billing-schedule"

const log = logger("starlink-billing-sync")

/** Every kit's Starlink login forwards here; the app's Exchange role is scoped to this mailbox only. */
export const STARLINK_BILLING_MAILBOX = "ict@acoblighting.com"

type Outcome = "applied" | "already_recorded" | "unmatched" | "waiting" | "error"

type GraphMessage = {
  id: string
  internetMessageId: string
  subject: string | null
  receivedDateTime: string
  hasAttachments: boolean
  body: { contentType: string; content: string }
  toRecipients?: Array<{ emailAddress?: { address?: string } }>
}

type GraphAttachment = {
  "@odata.type": string
  name: string
  contentType: string | null
  contentBytes?: string
}

type KitRow = { id: string; site_name: string; serial_number: string | null }

type PaymentRow = {
  id: string
  site_id: string
  title: string
  payment_type: "one-time" | "recurring"
  amount: number
  amount_paid: number | null
  next_payment_due: string | null
  last_payment_date: string | null
  department: { name: string | null } | Array<{ name: string | null }> | null
}

type DocumentRow = { id: string; document_type: string; file_name: string; applicable_date: string | null }

type StoredEvent = {
  graph_message_id: string
  kind: StarlinkMailKind
  received_at: string
  site_id: string | null
  invoice_number: string | null
  period_start: string | null
  outcome: Outcome
}

type EventResult = {
  outcome: Outcome
  detail?: string
  siteId?: string | null
  paymentId?: string | null
  documentId?: string | null
  periodStart?: string | null
}

export type StarlinkScheduleChange = {
  kit: string
  paymentId: string
  from: string | null
  to: string
  monthsPaid: string[]
  unpaid: string[]
}

export type StarlinkSyncSummary = {
  scanned: number
  skipped: number
  byOutcome: Record<Outcome, number>
  schedules: StarlinkScheduleChange[]
  dryRun: boolean
}

export type StarlinkSyncOptions = {
  /** Only emails received on/after this ISO date-time are read. */
  since: string
  /** Report what would happen without uploading or writing anything. */
  dryRun?: boolean
  now?: Date
}

function departmentName(payment: PaymentRow): string {
  const rel = payment.department
  const name = Array.isArray(rel) ? rel[0]?.name : rel?.name
  return name || "general"
}

async function listStarlinkMessages(since: string): Promise<GraphMessage[]> {
  const mailbox = encodeURIComponent(STARLINK_BILLING_MAILBOX)
  const filter = encodeURIComponent(
    `from/emailAddress/address eq '${STARLINK_SENDER}' and receivedDateTime ge ${new Date(since).toISOString()}`
  )
  let next: string | null =
    `/users/${mailbox}/messages?$filter=${filter}` +
    `&$select=id,internetMessageId,subject,receivedDateTime,hasAttachments,body,toRecipients&$top=100`
  const messages: GraphMessage[] = []
  while (next) {
    const page: { value: GraphMessage[]; "@odata.nextLink"?: string } = await graphGet(next)
    messages.push(...page.value)
    next = page["@odata.nextLink"]?.replace("https://graph.microsoft.com/v1.0", "") ?? null
  }
  // Oldest first, so a month's bill is filed before the emails that follow it.
  return messages.sort((a, b) => a.receivedDateTime.localeCompare(b.receivedDateTime))
}

async function listPdfAttachments(graphMessageId: string): Promise<GraphAttachment[]> {
  const mailbox = encodeURIComponent(STARLINK_BILLING_MAILBOX)
  const res: { value: GraphAttachment[] } = await graphGet(
    `/users/${mailbox}/messages/${encodeURIComponent(graphMessageId)}/attachments`
  )
  return res.value.filter(
    (a) =>
      a["@odata.type"] === "#microsoft.graph.fileAttachment" &&
      Boolean(a.contentBytes) &&
      (a.contentType === "application/pdf" || a.name.toLowerCase().endsWith(".pdf"))
  )
}

/**
 * Read Starlink billing emails from the ict mailbox and keep each kit's
 * recurring Starlink payment up to date:
 *
 * 1. File each email. A bill ("Automatic Payment Reminder") stores its invoice
 *    PDF against the month (applicable_date = billing period start); every
 *    billing email is logged in `starlink_billing_events`, once.
 * 2. Reconcile each kit's schedule from all its logged emails — see
 *    `reconcileStarlinkSchedule` for when a month counts as paid.
 *
 * Months already on file (uploaded by hand) are left alone, and a schedule only
 * ever moves forward.
 */
export async function syncStarlinkBilling(
  supabase: SupabaseClient,
  options: StarlinkSyncOptions
): Promise<StarlinkSyncSummary> {
  const dryRun = Boolean(options.dryRun)
  const now = options.now ?? new Date()
  const summary: StarlinkSyncSummary = {
    scanned: 0,
    skipped: 0,
    byOutcome: { applied: 0, already_recorded: 0, unmatched: 0, waiting: 0, error: 0 },
    schedules: [],
    dryRun,
  }

  const messages = (await listStarlinkMessages(options.since)).filter((m) => classifyStarlinkMail(m.subject))
  summary.scanned = messages.length

  const [kitsRes, paymentsRes, eventsRes] = await Promise.all([
    supabase.from("starlink_sites").select("id, site_name, serial_number"),
    supabase
      .from("department_payments")
      .select(
        "id, site_id, title, payment_type, amount, amount_paid, next_payment_due, last_payment_date, department:departments(name)"
      )
      .eq("category", "Starlink")
      .neq("status", "cancelled")
      .not("site_id", "is", null),
    // A few hundred rows a year; reading them all avoids a URL-length-bound IN list.
    supabase
      .from("starlink_billing_events")
      .select("graph_message_id, kind, received_at, site_id, invoice_number, period_start, outcome"),
  ])
  for (const res of [kitsRes, paymentsRes, eventsRes]) {
    if (res.error) throw new Error(res.error.message)
  }

  const kitsByAccount = new Map<string, KitRow>()
  const kitsById = new Map<string, KitRow>()
  for (const kit of (kitsRes.data || []) as KitRow[]) {
    kitsById.set(kit.id, kit)
    if (kit.serial_number) kitsByAccount.set(kit.serial_number.trim().toUpperCase(), kit)
  }
  const paymentsBySite = new Map<string, PaymentRow>()
  for (const payment of (paymentsRes.data || []) as PaymentRow[]) paymentsBySite.set(payment.site_id, payment)

  // Every logged email, updated in memory as this run files new ones.
  const events = new Map<string, StoredEvent>()
  for (const event of (eventsRes.data || []) as StoredEvent[]) events.set(event.graph_message_id, event)

  const invoicePeriods = new Map<string, string>()
  for (const event of events.values()) {
    if (event.kind === "reminder" && event.invoice_number && event.period_start) {
      invoicePeriods.set(event.invoice_number, event.period_start)
    }
  }

  const docsCache = new Map<string, DocumentRow[]>()
  async function documentsFor(paymentId: string): Promise<DocumentRow[]> {
    const cached = docsCache.get(paymentId)
    if (cached) return cached
    const { data, error } = await supabase
      .from("payment_documents")
      .select("id, document_type, file_name, applicable_date")
      .eq("payment_id", paymentId)
      .or("is_archived.is.null,is_archived.eq.false")
    if (error) throw new Error(error.message)
    const docs = (data || []) as DocumentRow[]
    docsCache.set(paymentId, docs)
    return docs
  }

  const onedrive = getOneDriveService()

  async function storeInvoicePdf(payment: PaymentRow, attachment: GraphAttachment, date: string): Promise<string> {
    if (!onedrive.isEnabled()) throw new Error("SharePoint storage is not enabled")
    const bytes = Buffer.from(attachment.contentBytes || "", "base64")
    const dept = departmentName(payment)
    const kind = payment.payment_type === "one-time" ? "one-time" : "recurring"
    const folder = buildPaymentDocumentFolderPathByType(dept, kind, payment.id, payment.title)
    const filePath = buildPaymentDocumentPath(dept, kind, payment.id, `${Date.now()}-${attachment.name}`, payment.title)
    await onedrive.createFolder(folder)
    await onedrive.uploadFile(filePath, new Uint8Array(bytes), "application/pdf")

    const { data, error } = await supabase
      .from("payment_documents")
      .insert({
        payment_id: payment.id,
        document_type: "invoice",
        file_name: attachment.name,
        file_path: filePath,
        file_size: bytes.length,
        mime_type: "application/pdf",
        applicable_date: date,
        uploaded_by: null,
        is_archived: false,
        description: "Filed automatically from the Starlink billing email",
      })
      .select("id, document_type, file_name, applicable_date")
      .single()
    if (error) throw new Error(error.message)
    docsCache.get(payment.id)?.push(data as DocumentRow)
    return (data as DocumentRow).id
  }

  async function fileReminder(
    parsed: ParsedStarlinkMail,
    payment: PaymentRow,
    pdfs: GraphAttachment[]
  ): Promise<EventResult> {
    if (!parsed.periodStart) return { outcome: "error", detail: "No billing period in the email" }
    const date = parsed.periodStart
    if (parsed.invoiceNumber) invoicePeriods.set(parsed.invoiceNumber, date)

    const docs = await documentsFor(payment.id)
    const onFile = docs.find(
      (d) =>
        d.applicable_date === date &&
        (d.document_type === "invoice" || (parsed.invoiceNumber && d.file_name.includes(parsed.invoiceNumber)))
    )
    if (onFile) {
      return { outcome: "already_recorded", documentId: onFile.id, periodStart: date, detail: `${date} bill on file` }
    }

    const pdf = pdfs[0]
    if (!pdf) return { outcome: "error", periodStart: date, detail: "Bill has no invoice PDF attached" }
    if (dryRun)
      return { outcome: "applied", periodStart: date, detail: `Would file ${pdf.name} as the ${date} invoice` }
    const documentId = await storeInvoicePdf(payment, pdf, date)
    return { outcome: "applied", documentId, periodStart: date, detail: `Filed ${pdf.name} as the ${date} invoice` }
  }

  async function fileProcessed(parsed: ParsedStarlinkMail, payment: PaymentRow): Promise<EventResult> {
    if (!parsed.invoiceNumber) return { outcome: "error", detail: "No invoice number in the email" }
    const docs = await documentsFor(payment.id)
    const periodStart =
      invoicePeriods.get(parsed.invoiceNumber) ??
      docs.find((d) => d.file_name.includes(parsed.invoiceNumber || ""))?.applicable_date ??
      null
    if (!periodStart) return { outcome: "waiting", detail: `Bill ${parsed.invoiceNumber} not seen yet` }
    return { outcome: "applied", periodStart, detail: `${periodStart} paid (${parsed.invoiceNumber})` }
  }

  function latestBillBefore(siteId: string, receivedAt: string): string | null {
    // Graph and Postgres format timestamps differently ("Z" vs "+00:00"), so compare as times.
    const cutoff = Date.parse(receivedAt)
    let best: { at: number; period: string } | null = null
    for (const e of events.values()) {
      if (e.kind !== "reminder" || e.site_id !== siteId || !e.period_start) continue
      const at = Date.parse(e.received_at)
      if (at > cutoff) continue
      if (!best || at > best.at) best = { at, period: e.period_start }
    }
    return best?.period ?? null
  }

  // 1. File each email --------------------------------------------------------
  for (const message of messages) {
    const kind = classifyStarlinkMail(message.subject)
    if (!kind) continue
    const prior = events.get(message.internetMessageId)
    // Unmatched emails are retried too: their kit may have been added since.
    if (prior && prior.outcome !== "waiting" && prior.outcome !== "error" && prior.outcome !== "unmatched") {
      summary.skipped += 1
      continue
    }

    const bodyText = message.body.contentType === "html" ? htmlToText(message.body.content) : message.body.content
    let result: EventResult
    let parsed: ParsedStarlinkMail | null = null
    try {
      const pdfs = kind === "reminder" && message.hasAttachments ? await listPdfAttachments(message.id) : []
      parsed = parseStarlinkMail(
        kind,
        bodyText,
        pdfs.map((p) => p.name)
      )
      const kit = parsed.accountNumber ? kitsByAccount.get(parsed.accountNumber.toUpperCase()) : undefined
      const payment = kit ? paymentsBySite.get(kit.id) : undefined
      if (!kit) {
        result = { outcome: "unmatched", detail: `No kit has account ${parsed.accountNumber ?? "(none)"}` }
      } else if (!payment) {
        result = { outcome: "unmatched", siteId: kit.id, detail: `Kit ${kit.site_name} has no Starlink payment` }
      } else {
        const base = { siteId: kit.id, paymentId: payment.id }
        if (kind === "reminder") result = { ...base, ...(await fileReminder(parsed, payment, pdfs)) }
        else if (kind === "processed") result = { ...base, ...(await fileProcessed(parsed, payment)) }
        else {
          // A failure belongs to the kit's latest bill before it.
          const bill = latestBillBefore(kit.id, message.receivedDateTime)
          result = {
            ...base,
            outcome: "applied",
            periodStart: bill,
            detail: `Payment of ${parsed.amount ?? "?"} failed${bill ? ` for the ${bill} bill` : ""}`,
          }
        }
      }
    } catch (err) {
      result = { outcome: "error", detail: err instanceof Error ? err.message : String(err) }
      log.error({ err: result.detail, subject: message.subject }, "Failed to file Starlink email")
    }

    summary.byOutcome[result.outcome] += 1
    events.set(message.internetMessageId, {
      graph_message_id: message.internetMessageId,
      kind,
      received_at: message.receivedDateTime,
      site_id: result.siteId ?? null,
      invoice_number: parsed?.invoiceNumber ?? null,
      period_start: result.periodStart ?? parsed?.periodStart ?? null,
      outcome: result.outcome,
    })
    if (dryRun) continue

    const { error } = await supabase.from("starlink_billing_events").upsert(
      {
        graph_message_id: message.internetMessageId,
        kind,
        received_at: message.receivedDateTime,
        account_number: parsed?.accountNumber ?? null,
        recipient_email: message.toRecipients?.[0]?.emailAddress?.address?.toLowerCase() ?? null,
        invoice_number: parsed?.invoiceNumber ?? null,
        amount: parsed?.amount ?? null,
        currency: parsed?.currency ?? null,
        period_start: result.periodStart ?? parsed?.periodStart ?? null,
        period_end: parsed?.periodEnd ?? null,
        site_id: result.siteId ?? null,
        payment_id: result.paymentId ?? null,
        document_id: result.documentId ?? null,
        outcome: result.outcome,
        detail: result.detail ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "graph_message_id" }
    )
    if (error) log.error({ err: error.message }, "Failed to log Starlink email")
  }

  // 2. Reconcile each kit's schedule -----------------------------------------
  const bySite = new Map<string, BillingEventForSchedule[]>()
  for (const event of events.values()) {
    if (!event.site_id || event.outcome === "unmatched" || event.outcome === "error") continue
    const list = bySite.get(event.site_id) ?? []
    list.push({
      kind: event.kind,
      receivedAt: event.received_at,
      periodStart: event.period_start,
      waiting: event.outcome === "waiting",
    })
    bySite.set(event.site_id, list)
  }

  for (const [siteId, siteEvents] of bySite) {
    const payment = paymentsBySite.get(siteId)
    if (!payment || payment.payment_type !== "recurring") continue
    const plan = reconcileStarlinkSchedule(payment.next_payment_due?.slice(0, 10) ?? null, siteEvents, now)
    if (!plan) continue

    const paidAmount = payment.amount * plan.monthsPaid.length
    summary.schedules.push({
      kit: kitsById.get(siteId)?.site_name ?? siteId,
      paymentId: payment.id,
      from: payment.next_payment_due?.slice(0, 10) ?? null,
      to: plan.nextDue,
      monthsPaid: plan.monthsPaid,
      unpaid: plan.unpaid,
    })
    if (dryRun) continue

    const { error } = await supabase
      .from("department_payments")
      .update({
        next_payment_due: plan.nextDue,
        last_payment_date: plan.monthsPaid[plan.monthsPaid.length - 1],
        amount_paid: (payment.amount_paid || 0) + paidAmount,
        status: "due",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id)
    if (error) throw new Error(error.message)
  }

  return summary
}
