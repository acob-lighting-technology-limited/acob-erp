/** A Starlink kit serving a project (`starlink_sites`). `serial_number` is the ACC-... account. */
export type ProjectKitRow = {
  id: string
  site_name: string
  state: string | null
  serial_number: string | null
  kit_number: string | null
  is_active: boolean
}

/** A payment charged to a project (`department_payments.project_id`). */
export type ProjectPaymentRow = {
  id: string
  title: string
  category: string
  payment_type: "one-time" | "recurring"
  amount: number
  amount_paid: number | null
  currency: string
  status: "due" | "paid" | "overdue" | "cancelled"
  next_payment_due: string | null
  payment_date: string | null
  site_id: string | null
  documents: Array<{ document_type: string; applicable_date: string | null }>
}

export type ProjectPaymentsData = { kits: ProjectKitRow[]; payments: ProjectPaymentRow[] }

/**
 * The stored status goes stale (nobody flips it), so judge a payment by its own
 * date, the same way the payment page does.
 */
export function projectPaymentStatus(payment: ProjectPaymentRow, todayISO: string): "paid" | "due" | "overdue" {
  if (payment.status === "paid") return "paid"
  const date = (payment.payment_type === "recurring" ? payment.next_payment_due : payment.payment_date)?.slice(0, 10)
  if (!date) return "due"
  return date < todayISO ? "overdue" : "due"
}
