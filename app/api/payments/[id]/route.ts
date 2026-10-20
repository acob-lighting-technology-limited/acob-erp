import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { parseJsonBody } from "@/lib/api/parse-body"
import { z } from "zod"
import { isFinanceDepartment, normalizeDepartment } from "@/lib/payments/department"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { getDepartmentScope, resolveAdminScope } from "@/lib/admin/rbac"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { classifyStarlinkMonths, type StarlinkMonth } from "@/lib/starlink/billing-schedule"
import { serverError } from "@/lib/api/errors"
import { logger } from "@/lib/logger"

const log = logger("api/payments/id")

type PaymentsClient = Awaited<ReturnType<typeof createClient>>

type DepartmentRelation = { name?: string | null } | Array<{ name?: string | null }> | null

type PaymentDepartmentRecord = {
  department?: DepartmentRelation
  created_by?: string | null
}

async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Ignore errors from Server Components
        }
      },
    },
  })
}

function getRelatedDepartmentName(payment: PaymentDepartmentRecord | null | undefined): string | null {
  const relation = payment?.department
  if (!relation) return null
  if (Array.isArray(relation)) return relation[0]?.name ?? null
  return relation?.name ?? null
}

/**
 * A Starlink kit's payment also carries each billed month's status (confirmed /
 * autopay / failed / pending), worked out from its billing emails.
 */
async function withStarlinkMonths<T extends { site_id?: string | null }>(
  client: SupabaseClient,
  payment: T
): Promise<T & { starlink_months?: StarlinkMonth[] }> {
  if (!payment?.site_id) return payment
  const { data, error } = await client
    .from("starlink_billing_events")
    .select("kind, received_at, period_start, outcome")
    .eq("site_id", payment.site_id)
    .in("outcome", ["applied", "already_recorded", "waiting"])
  if (error) return payment
  const events = (data || []) as Array<{
    kind: "reminder" | "processed" | "failed"
    received_at: string
    period_start: string | null
    outcome: string
  }>
  return {
    ...payment,
    starlink_months: classifyStarlinkMonths(
      events.map((e) => ({
        kind: e.kind,
        receivedAt: e.received_at,
        periodStart: e.period_start,
        waiting: e.outcome === "waiting",
      })),
      new Date()
    ),
  }
}

// GET /api/payments/[id] - Get a single payment
export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const supabase = await createClient()
    const { id } = params

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const scope = await resolveAdminScope(supabase, user.id)
    const { data: profile } = await supabase.from("profiles").select("department").eq("id", user.id).single()
    const dataClient = getServiceRoleClientOrFallback(supabase)

    const baseSelect = `
                *,
                department:departments(*),
                documents:payment_documents(*)`
    const linkedSelect = `${baseSelect},
                project:projects(id, project_name),
                site:starlink_sites(id, site_name, state, serial_number, kit_number)`

    let { data: payment, error } = await dataClient
      .from("department_payments")
      .select(linkedSelect)
      .eq("id", id)
      .single()

    // Until migration 20261010120000 is live there is no project_id/kit_number to
    // join on; fall back to the unlinked payment rather than failing the page.
    if (error && (error.code === "PGRST200" || error.code === "42703")) {
      ;({ data: payment, error } = await dataClient
        .from("department_payments")
        .select(baseSelect)
        .eq("id", id)
        .single())
    }

    if (error) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (scope) {
      const scopedDepartments = getDepartmentScope(scope, "finance")
      if (scopedDepartments) {
        const paymentDepartmentName = getRelatedDepartmentName(payment)
        const isInScope = scopedDepartments.some(
          (dept) => normalizeDepartment(dept) === normalizeDepartment(paymentDepartmentName)
        )
        if (!paymentDepartmentName || !isInScope) {
          return NextResponse.json({ error: "Forbidden: outside your finance scope" }, { status: 403 })
        }
      }
    } else {
      if (payment?.created_by === user.id) {
        return NextResponse.json({ data: await withStarlinkMonths(dataClient, payment) })
      }

      if (!isFinanceDepartment(profile?.department)) {
        return NextResponse.json({ error: "Forbidden: finance access required" }, { status: 403 })
      }
      if (normalizeDepartment(getRelatedDepartmentName(payment)) !== normalizeDepartment(profile?.department)) {
        return NextResponse.json({ error: "Forbidden: Department mismatch" }, { status: 403 })
      }
    }

    return NextResponse.json({ data: await withStarlinkMonths(dataClient, payment) })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/payments/[id] - Update a payment
const optionalDate = z.string().trim().max(40).nullable().optional()

const UpdatePaymentSchema = z.object({
  department_id: z.union([z.string().uuid(), z.literal("")]).optional(),
  payment_type: z.string().max(40).optional(),
  category: z.enum(["one-time", "recurring"]).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  amount: z.number().finite().min(0).optional(),
  currency: z.string().trim().length(3).optional(),
  recurrence_period: z.string().max(40).nullable().optional(),
  next_payment_due: optionalDate,
  last_payment_date: optionalDate,
  payment_date: optionalDate,
  status: z.string().max(40).optional(),
  amount_paid: z.number().finite().min(0).optional(),
  issuer_name: z.string().max(200).nullable().optional(),
  issuer_phone_number: z.string().max(50).nullable().optional(),
  issuer_address: z.string().max(500).nullable().optional(),
  payment_reference: z.string().max(200).nullable().optional(),
  invoice_number: z.string().max(200).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
})

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const rl = await rateLimit(`payments:${getClientId(request)}`, { limit: 20, windowSec: 60 })
  if (!rl.allowed)
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      { status: 429 }
    )
  try {
    const supabase = await createClient()
    const { id } = params
    // Only editable columns pass; created_by, id, timestamps and unknown keys are
    // stripped. (The update below runs with the service role, so the raw body
    // used to let any caller who passed the checks rewrite any column.)
    const parsed = await parseJsonBody(request, UpdatePaymentSchema)
    if (!parsed.ok) return parsed.response
    const body: Record<string, unknown> = { ...parsed.data }
    if (body.department_id === "") delete body.department_id

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const scope = await resolveAdminScope(supabase, user.id)
    const { data: profile } = await supabase.from("profiles").select("department").eq("id", user.id).single()
    const dataClient = getServiceRoleClientOrFallback(supabase)

    // Check permissions (scoped admin/lead or department member)
    if (!scope) {
      const { data: payment } = await dataClient
        .from("department_payments")
        .select("department:departments(name), created_by")
        .eq("id", id)
        .single()

      const isOwner = payment?.created_by === user.id
      if (isOwner) {
        // Owners can edit their own payments regardless of admin/finance role.
      } else {
        if (!isFinanceDepartment(profile?.department)) {
          return NextResponse.json({ error: "Forbidden: finance access required" }, { status: 403 })
        }

        const paymentDept = getRelatedDepartmentName(payment)
        const userDept = profile?.department

        if (normalizeDepartment(paymentDept) !== normalizeDepartment(userDept)) {
          return NextResponse.json({ error: "Forbidden: Department mismatch" }, { status: 403 })
        }
      }

      // Determine if this is a "status update" or "full edit"
      // Status updates (marking as paid, recording payments) are allowed for all department members
      // Full edits (changing title, amount, etc.) require being the creator
      const bodyKeys = Object.keys(body)
      const allowedStatusKeys = ["status", "amount_paid", "next_payment_due", "last_payment_date"]
      const isStatusUpdate =
        (body.status !== undefined ||
          body.amount_paid !== undefined ||
          body.next_payment_due !== undefined ||
          body.last_payment_date !== undefined) &&
        bodyKeys.every((key) => allowedStatusKeys.includes(key))

      // If it's a full edit (not just status update), enforce creator check
      if (!isStatusUpdate && !isOwner) {
        return NextResponse.json({ error: "Forbidden: You can only edit payments you created" }, { status: 403 })
      }
    } else if (scope) {
      const { data: payment } = await dataClient
        .from("department_payments")
        .select("department:departments(name), created_by")
        .eq("id", id)
        .single()

      const scopedDepartments = getDepartmentScope(scope, "finance")
      const paymentDept = getRelatedDepartmentName(payment)
      const isInScope = scopedDepartments
        ? scopedDepartments.some((dept) => normalizeDepartment(dept) === normalizeDepartment(paymentDept))
        : false
      if (scopedDepartments && (!paymentDept || !isInScope)) {
        return NextResponse.json({ error: "Forbidden: outside your finance scope" }, { status: 403 })
      }
    }

    // Validate and sync category with payment_type if category is being updated
    // Sync payment_type with category (the schema already limits category).
    if (body.category) body.payment_type = body.category

    const { data: updatedPayment, error } = await dataClient
      .from("department_payments")
      .update(body)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return serverError(log, error)
    }

    await writeAuditLog(
      supabase as PaymentsClient,
      {
        action: "update",
        entityType: "payment",
        entityId: id,
        newValues: body,
        context: { actorId: user.id, source: "api", route: `/api/payments/${id}` },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data: updatedPayment })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/payments/[id] - Soft delete a payment
export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const rl = await rateLimit(`payments:${getClientId(request)}`, { limit: 20, windowSec: 60 })
  if (!rl.allowed)
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      { status: 429 }
    )
  try {
    const supabase = await createClient()
    const { id } = params

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const scope = await resolveAdminScope(supabase, user.id)
    const { data: profile } = await supabase.from("profiles").select("department").eq("id", user.id).single()
    const dataClient = getServiceRoleClientOrFallback(supabase)

    if (scope) {
      const { data: payment } = await dataClient
        .from("department_payments")
        .select("created_by, department:departments(name)")
        .eq("id", id)
        .single()
      const scopedDepartments = getDepartmentScope(scope, "finance")
      const paymentDept = getRelatedDepartmentName(payment)
      const isInScope = scopedDepartments
        ? scopedDepartments.some((dept) => normalizeDepartment(dept) === normalizeDepartment(paymentDept))
        : false
      if (scopedDepartments && (!paymentDept || !isInScope)) {
        return NextResponse.json({ error: "Forbidden: outside your finance scope" }, { status: 403 })
      }
    } else {
      if (!isFinanceDepartment(profile?.department)) {
        return NextResponse.json({ error: "Forbidden: finance access required" }, { status: 403 })
      }

      const { data: payment } = await dataClient.from("department_payments").select("created_by").eq("id", id).single()
      if (!payment || payment.created_by !== user.id) {
        return NextResponse.json({ error: "Forbidden: You can only delete payments you created" }, { status: 403 })
      }
    }

    const { data: softDeletedPayment, error } = await dataClient
      .from("department_payments")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id")
      .single()

    if (error) {
      return serverError(log, error)
    }

    await writeAuditLog(
      supabase as PaymentsClient,
      {
        action: "delete",
        entityType: "payment",
        entityId: id,
        newValues: { status: "cancelled" },
        context: { actorId: user.id, source: "api", route: `/api/payments/${id}` },
      },
      { failOpen: true }
    )

    return NextResponse.json({ success: true, data: softDeletedPayment })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
