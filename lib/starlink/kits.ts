import type { SupabaseClient } from "@supabase/supabase-js"
import { classifyStarlinkMonths, type StarlinkMonth } from "@/lib/starlink/billing-schedule"

/** A Starlink kit as the kits page lists it. `serial_number` is the ACC-... account. */
export type StarlinkKitListRow = {
  id: string
  site_name: string
  state: string | null
  serial_number: string | null
  kit_number: string | null
  email: string | null
  is_active: boolean
  project: { id: string; project_name: string } | null
  payment: {
    id: string
    amount: number
    currency: string
    next_payment_due: string | null
  } | null
  /** The most recent billed month and its status, from Starlink's emails. */
  latest_month: StarlinkMonth | null
}

/** A Starlink account seen in the ict mailbox that matches no kit yet. */
export type UnmatchedStarlinkAccount = {
  account_number: string
  recipient_email: string | null
  emails: number
  first_seen: string
  last_seen: string
  amount: number | null
  currency: string | null
  /** Earliest billing period seen — where a new kit's schedule should start. */
  first_period_start: string | null
}

export type StarlinkKitsData = { kits: StarlinkKitListRow[]; unmatched: UnmatchedStarlinkAccount[] }

type KitDbRow = Omit<StarlinkKitListRow, "project" | "payment" | "latest_month"> & {
  project: { id: string; project_name: string } | Array<{ id: string; project_name: string }> | null
}

type EventDbRow = {
  kind: "reminder" | "processed" | "failed"
  received_at: string
  site_id: string | null
  account_number: string | null
  recipient_email: string | null
  amount: number | null
  currency: string | null
  period_start: string | null
  outcome: string
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

/** Every kit with its project, payment and latest month, plus accounts seen in email but not yet added. */
export async function loadStarlinkKits(supabase: SupabaseClient): Promise<StarlinkKitsData> {
  const [kitsRes, paymentsRes, eventsRes] = await Promise.all([
    supabase
      .from("starlink_sites")
      .select("id, site_name, state, serial_number, kit_number, email, is_active, project:projects(id, project_name)")
      .order("site_name"),
    supabase
      .from("department_payments")
      .select("id, site_id, amount, currency, next_payment_due")
      .eq("category", "Starlink")
      .neq("status", "cancelled")
      .not("site_id", "is", null),
    supabase
      .from("starlink_billing_events")
      .select("kind, received_at, site_id, account_number, recipient_email, amount, currency, period_start, outcome"),
  ])
  for (const res of [kitsRes, paymentsRes, eventsRes]) {
    if (res.error) throw new Error(res.error.message)
  }

  const paymentsBySite = new Map<string, StarlinkKitListRow["payment"]>()
  for (const p of (paymentsRes.data || []) as Array<{
    id: string
    site_id: string
    amount: number
    currency: string
    next_payment_due: string | null
  }>) {
    paymentsBySite.set(p.site_id, {
      id: p.id,
      amount: Number(p.amount),
      currency: p.currency || "NGN",
      next_payment_due: p.next_payment_due,
    })
  }

  const events = (eventsRes.data || []) as EventDbRow[]
  const eventsBySite = new Map<string, EventDbRow[]>()
  const unmatchedByAccount = new Map<string, EventDbRow[]>()
  for (const e of events) {
    if (e.outcome === "unmatched" && e.account_number) {
      const list = unmatchedByAccount.get(e.account_number) ?? []
      list.push(e)
      unmatchedByAccount.set(e.account_number, list)
    } else if (e.site_id && e.outcome !== "error") {
      const list = eventsBySite.get(e.site_id) ?? []
      list.push(e)
      eventsBySite.set(e.site_id, list)
    }
  }

  const now = new Date()
  const kits: StarlinkKitListRow[] = ((kitsRes.data || []) as KitDbRow[]).map((kit) => {
    const months = classifyStarlinkMonths(
      (eventsBySite.get(kit.id) ?? []).map((e) => ({
        kind: e.kind,
        receivedAt: e.received_at,
        periodStart: e.period_start,
        waiting: e.outcome === "waiting",
      })),
      now
    )
    return {
      ...kit,
      project: one(kit.project),
      payment: paymentsBySite.get(kit.id) ?? null,
      latest_month: months[months.length - 1] ?? null,
    }
  })

  const unmatched: UnmatchedStarlinkAccount[] = [...unmatchedByAccount.entries()]
    .map(([account, list]) => {
      const sorted = [...list].sort((a, b) => a.received_at.localeCompare(b.received_at))
      const bills = sorted.filter((e) => e.kind === "reminder" && e.period_start)
      const latestWithAmount = [...sorted].reverse().find((e) => e.amount != null)
      return {
        account_number: account,
        recipient_email: [...sorted].reverse().find((e) => e.recipient_email)?.recipient_email ?? null,
        emails: sorted.length,
        first_seen: sorted[0].received_at,
        last_seen: sorted[sorted.length - 1].received_at,
        amount: latestWithAmount?.amount != null ? Number(latestWithAmount.amount) : null,
        currency: latestWithAmount?.currency ?? null,
        first_period_start: bills[0]?.period_start ?? null,
      }
    })
    .sort((a, b) => b.last_seen.localeCompare(a.last_seen))

  return { kits, unmatched }
}
