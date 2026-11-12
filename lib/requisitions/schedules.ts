import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { signedStorageUrl } from "@/lib/approval-signing/server"
import { bankCodeForName } from "./bank-file"
import { buildBankWorkbookFile } from "./bank-workbook"
import { findMdId } from "./routing"
import { loadPaymentOfficers, loadRoutingLeads, REQUISITION_DOCUMENTS_BUCKET, type ViewerContext } from "./server"
import type { PaymentSchedule, PaymentScheduleItem, Requisition, SchedulableLine } from "./types"

const PERSON = "id, full_name, department, designation"

const SCHEDULE_SELECT = `
  *,
  creator:profiles!requisition_payment_schedules_created_by_fkey(${PERSON}),
  sender:profiles!requisition_payment_schedules_sent_by_fkey(${PERSON})
`

const ITEM_SELECT = `
  *,
  recorder:profiles!requisition_schedule_items_recorded_by_fkey(${PERSON}),
  requisition:requisitions(
    id, requisition_number, department, purpose, status, amount, amount_paid, user_id, form_type, created_at,
    unpaid_at, unpaid_note, unpaid_count,
    requester:profiles!requisitions_user_id_fkey(${PERSON}),
    stages:requisition_stages(
      id, requisition_id, position, stage_code, role_key, role_label, assignee_id, state, state_note,
      acted_by, acted_at, comments, signature_path,
      assignee:profiles!requisition_stages_assignee_id_fkey(${PERSON}),
      actor:profiles!requisition_stages_acted_by_fkey(${PERSON})
    ),
    payments:requisition_payments(
      id, amount, paid_on, recorded_by, created_at,
      recorder:profiles!requisition_payments_recorded_by_fkey(${PERSON})
    )
  )
`

/** Who may build and record schedules (Payment Request officers) and who may only look (admins, the MD). */
export async function scheduleAccess(admin: SupabaseClient, viewer: ViewerContext) {
  const isOfficer = viewer.paymentFormTypes.includes("payment_request")
  const mdId = findMdId(await loadRoutingLeads(admin))
  const isMd = mdId === viewer.userId
  return { isOfficer, isMd, mdId, canView: isOfficer || isMd || viewer.isAdminLike }
}

export async function listSchedules(admin: SupabaseClient): Promise<PaymentSchedule[]> {
  const [{ data: schedules, error }, { data: items, error: itemsError }] = await Promise.all([
    admin.from("requisition_payment_schedules").select(SCHEDULE_SELECT).order("created_at", { ascending: false }),
    admin.from("requisition_schedule_items").select("schedule_id, amount, outcome"),
  ])
  if (error) throw new Error(`Failed to list schedules: ${error.message}`)
  if (itemsError) throw new Error(`Failed to list schedule lines: ${itemsError.message}`)
  return ((schedules || []) as PaymentSchedule[]).map((s) => {
    const own = (items || []).filter((i) => i.schedule_id === s.id)
    return {
      ...s,
      line_count: own.length,
      total_amount: own.reduce((sum, i) => sum + Number(i.amount), 0),
      paid_amount: own.filter((i) => i.outcome === "paid").reduce((sum, i) => sum + Number(i.amount), 0),
    }
  })
}

export async function loadSchedule(
  admin: SupabaseClient,
  id: string,
  { withReceipts = false } = {}
): Promise<PaymentSchedule | null> {
  const [{ data: schedule, error }, { data: items, error: itemsError }] = await Promise.all([
    admin.from("requisition_payment_schedules").select(SCHEDULE_SELECT).eq("id", id).maybeSingle<PaymentSchedule>(),
    admin
      .from("requisition_schedule_items")
      .select(ITEM_SELECT)
      .eq("schedule_id", id)
      .order("created_at")
      .returns<PaymentScheduleItem[]>(),
  ])
  if (error) throw new Error(`Failed to load schedule: ${error.message}`)
  if (itemsError) throw new Error(`Failed to load schedule lines: ${itemsError.message}`)
  if (!schedule) return null
  const lines = items || []
  // The route's payment block names who pays; the same officers for every line.
  const officers = await loadPaymentOfficers(admin)
  for (const item of lines) {
    if (item.requisition) item.requisition.payment_officers = officers[item.requisition.form_type] ?? []
  }
  if (withReceipts) {
    await Promise.all(
      lines.map(async (item) => {
        item.receipt_url = item.receipt_path
          ? await signedStorageUrl(admin, REQUISITION_DOCUMENTS_BUCKET, item.receipt_path)
          : null
      })
    )
  }
  return { ...schedule, items: lines }
}

/** Every verified Payment Request line not yet paid and not on a live schedule. */
export async function loadSchedulableLines(admin: SupabaseClient): Promise<SchedulableLine[]> {
  const { data: reqs, error } = await admin
    .from("requisitions")
    .select(
      "id, requisition_number, department, purpose, amount, amount_paid, beneficiary_details, user_id, unpaid_at, status, created_at, requester:profiles!requisitions_user_id_fkey(full_name)"
    )
    .eq("form_type", "payment_request")
    .in("status", ["awaiting_payment", "partly_paid", "scheduled"])
    .order("created_at")
  if (error) throw new Error(`Failed to load payable requisitions: ${error.message}`)
  const rows = (reqs || []) as unknown as (Pick<
    Requisition,
    | "id"
    | "requisition_number"
    | "department"
    | "purpose"
    | "amount"
    | "amount_paid"
    | "beneficiary_details"
    | "user_id"
    | "unpaid_at"
    | "created_at"
  > & { requester: { full_name: string | null } | null })[]
  if (!rows.length) return []

  const { data: items, error: itemsError } = await admin
    .from("requisition_schedule_items")
    .select("requisition_id, beneficiary_index, amount, outcome")
    .in(
      "requisition_id",
      rows.map((r) => r.id)
    )
  if (itemsError) throw new Error(`Failed to load schedule lines: ${itemsError.message}`)

  const lines: SchedulableLine[] = []
  for (const req of rows) {
    const own = (items || []).filter((i) => i.requisition_id === req.id)
    const pendingTotal = own.filter((i) => i.outcome === "pending").reduce((s, i) => s + Number(i.amount), 0)
    const outstanding = Math.round((Number(req.amount) - Number(req.amount_paid) - pendingTotal) * 100) / 100
    if (outstanding <= 0) continue
    req.beneficiary_details.forEach((b, index) => {
      // Cash is handed over, not transferred: it never goes on a bank schedule.
      if (b.payment_method === "cash") return
      const live = own.some((i) => i.beneficiary_index === index && i.outcome !== "unpaid")
      if (live) return
      const single = req.beneficiary_details.length === 1
      const lineAmount = single ? outstanding : b.amount != null && b.amount !== "" ? Number(b.amount) : null
      lines.push({
        requisition_id: req.id,
        requisition_number: req.requisition_number,
        department: req.department,
        purpose: req.purpose,
        requester_name: req.requester?.full_name ?? null,
        requested_at: req.created_at,
        requisition_amount: Number(req.amount),
        beneficiary_index: index,
        account_name: b.verified_account_name || b.account_name,
        account_number: b.account_number,
        bank_name: b.bank_name,
        bank_code: b.bank_code || bankCodeForName(b.bank_name),
        amount: lineAmount != null ? Math.min(lineAmount, outstanding) : null,
        outstanding,
        unpaid_before: own.some((i) => i.beneficiary_index === index && i.outcome === "unpaid"),
      })
    })
  }
  return lines
}

/** The bank's bulk-upload workbook for a schedule. */
export async function buildBankWorkbook(schedule: PaymentSchedule): Promise<Buffer> {
  return buildBankWorkbookFile(schedule.items || [], schedule.payment_date, schedule.debit_account)
}

export async function readSetting(admin: SupabaseClient, key: string): Promise<string | null> {
  const { data, error } = await admin.from("requisition_settings").select("value").eq("key", key).maybeSingle()
  if (error) throw new Error(`Failed to read setting: ${error.message}`)
  return (data?.value as string | undefined) ?? null
}
