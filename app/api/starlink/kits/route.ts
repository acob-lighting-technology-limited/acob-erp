import { NextResponse } from "next/server"
import { z } from "zod"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { syncStarlinkBilling } from "@/lib/starlink/billing-sync"
import { requireStarlinkKitAccess } from "@/lib/starlink/kit-access"
import { loadStarlinkKits } from "@/lib/starlink/kits"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const log = logger("starlink-kits-api")

const optionalText = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))

const CreateKitSchema = z.object({
  site_name: z.string().trim().min(1, "Kit name is required"),
  state: optionalText,
  account_number: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^ACC-[A-Z0-9-]+$/, "Starlink account numbers look like ACC-..."),
  kit_number: optionalText,
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  project_id: z.string().uuid().optional().nullable(),
  amount: z.coerce.number().positive("Monthly amount is required"),
  currency: z.string().trim().default("NGN"),
  next_payment_due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "First billing date is required"),
})

/** GET /api/starlink/kits — kits, and Starlink accounts seen in email that are not kits yet. */
export async function GET() {
  const access = await requireStarlinkKitAccess()
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  try {
    return NextResponse.json({ data: await loadStarlinkKits(access.dataClient) })
  } catch (err) {
    log.error({ err: String(err) }, "Failed to load Starlink kits")
    return NextResponse.json({ error: "Failed to load Starlink kits" }, { status: 500 })
  }
}

/**
 * POST /api/starlink/kits — add a kit and its monthly Starlink payment, then file
 * any of its emails already in the ict mailbox.
 */
export async function POST(request: Request) {
  const rl = await rateLimit(`starlink-kits:${getClientId(request)}`, { limit: 10, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const access = await requireStarlinkKitAccess()
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const { dataClient, userId } = access

  const parsed = CreateKitSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid kit" }, { status: 400 })
  }
  const input = parsed.data

  const { data: existing } = await dataClient
    .from("starlink_sites")
    .select("id, site_name")
    .eq("serial_number", input.account_number)
    .maybeSingle()
  if (existing) {
    return NextResponse.json(
      { error: `${input.account_number} is already the ${existing.site_name} kit` },
      { status: 409 }
    )
  }

  // New kits are billed the same way as the existing ones: under the department
  // that already pays for Starlink.
  const { data: template } = await dataClient
    .from("department_payments")
    .select("department_id, issuer_name, issuer_phone_number, issuer_address")
    .eq("category", "Starlink")
    .not("site_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!template?.department_id) {
    return NextResponse.json({ error: "No existing Starlink payment to take the department from" }, { status: 409 })
  }

  const { data: kit, error: kitError } = await dataClient
    .from("starlink_sites")
    .insert({
      site_name: input.site_name,
      state: input.state ?? "",
      serial_number: input.account_number,
      kit_number: input.kit_number,
      email: input.email,
      project_id: input.project_id ?? null,
      is_active: true,
      created_by: userId,
    })
    .select("id")
    .single()
  if (kitError || !kit) {
    log.error({ err: kitError?.message }, "Failed to create Starlink kit")
    return NextResponse.json({ error: kitError?.message ?? "Failed to create kit" }, { status: 500 })
  }

  const { data: payment, error: paymentError } = await dataClient
    .from("department_payments")
    .insert({
      department_id: template.department_id,
      payment_type: "recurring",
      category: "Starlink",
      title: input.site_name,
      amount: input.amount,
      currency: input.currency,
      recurrence_period: "monthly",
      next_payment_due: input.next_payment_due,
      status: "due",
      amount_paid: 0,
      issuer_name: template.issuer_name,
      issuer_phone_number: template.issuer_phone_number,
      issuer_address: template.issuer_address,
      site_id: kit.id,
      project_id: input.project_id ?? null,
      created_by: userId,
    })
    .select("id")
    .single()
  if (paymentError || !payment) {
    await dataClient.from("starlink_sites").delete().eq("id", kit.id)
    log.error({ err: paymentError?.message }, "Failed to create Starlink payment")
    return NextResponse.json({ error: paymentError?.message ?? "Failed to create payment" }, { status: 500 })
  }

  await writeAuditLog(
    access.supabase,
    {
      action: "create",
      entityType: "starlink_kit",
      entityId: kit.id,
      newValues: { site_name: input.site_name, account: input.account_number, payment_id: payment.id },
      context: { actorId: userId, source: "api", route: "/api/starlink/kits" },
    },
    { failOpen: true }
  )

  // File this account's emails that arrived before the kit existed.
  let synced: Awaited<ReturnType<typeof syncStarlinkBilling>> | null = null
  try {
    const { data: firstSeen } = await dataClient
      .from("starlink_billing_events")
      .select("received_at")
      .eq("account_number", input.account_number)
      .order("received_at")
      .limit(1)
      .maybeSingle()
    if (firstSeen?.received_at) {
      synced = await syncStarlinkBilling(dataClient, { since: firstSeen.received_at })
    }
  } catch (err) {
    log.error({ err: String(err) }, "Kit created but its past emails could not be filed yet")
  }

  return NextResponse.json({ data: { kit_id: kit.id, payment_id: payment.id, synced } }, { status: 201 })
}
