import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { getDepartmentScope, resolveAdminScope } from "@/lib/admin/rbac"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { writeAuditLog } from "@/lib/audit/write-audit"

function createClient() {
  const cookieStore = cookies()

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

function getRelatedDepartmentName(payment: any): string | null {
  const relation = payment?.department
  if (!relation) return null
  if (Array.isArray(relation)) return relation[0]?.name ?? null
  return relation?.name ?? null
}

function normalizeDepartment(value: string | null | undefined): string {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
  if (normalized === "finance") return "accounts"
  return normalized
}

function isFinanceDepartment(value: string | null | undefined): boolean {
  const normalized = normalizeDepartment(value)
  return normalized === "accounts"
}

// GET /api/payments/[id] - Get a single payment
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const { id } = params

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const scope = await resolveAdminScope(supabase as any, user.id)
    const { data: profile } = await supabase.from("profiles").select("department").eq("id", user.id).single()
    const dataClient = getServiceRoleClientOrFallback(supabase as any)

    const { data: payment, error } = await dataClient
      .from("department_payments")
      .select(
        `
                *,
                department:departments(*),
                documents:payment_documents(*)
            `
      )
      .eq("id", id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
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
      if (!isFinanceDepartment(profile?.department)) {
        return NextResponse.json({ error: "Forbidden: finance access required" }, { status: 403 })
      }
      if (normalizeDepartment(getRelatedDepartmentName(payment)) !== normalizeDepartment(profile?.department)) {
        return NextResponse.json({ error: "Forbidden: Department mismatch" }, { status: 403 })
      }
    }

    return NextResponse.json({ data: payment })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
  }
}

// PATCH /api/payments/[id] - Update a payment
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const { id } = params
    const body = await request.json()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const scope = await resolveAdminScope(supabase as any, user.id)
    const { data: profile } = await supabase.from("profiles").select("department").eq("id", user.id).single()
    const dataClient = getServiceRoleClientOrFallback(supabase as any)

    // Check permissions (scoped admin/lead or department member)
    if (!scope) {
      if (!isFinanceDepartment(profile?.department)) {
        return NextResponse.json({ error: "Forbidden: finance access required" }, { status: 403 })
      }

      const { data: payment } = await dataClient
        .from("department_payments")
        .select("department:departments(name), created_by")
        .eq("id", id)
        .single()

      const paymentDept = getRelatedDepartmentName(payment)
      const userDept = profile?.department

      if (normalizeDepartment(paymentDept) !== normalizeDepartment(userDept)) {
        return NextResponse.json({ error: "Forbidden: Department mismatch" }, { status: 403 })
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
      if (!isStatusUpdate && payment?.created_by !== user.id) {
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
    if (body.category) {
      if (body.category !== "one-time" && body.category !== "recurring") {
        return NextResponse.json({ error: "Category must be 'one-time' or 'recurring'" }, { status: 400 })
      }
      // Sync payment_type with category
      body.payment_type = body.category
    }

    const { data: updatedPayment, error } = await dataClient
      .from("department_payments")
      .update(body)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await writeAuditLog(
      supabase as any,
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
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
  }
}

// DELETE /api/payments/[id] - Delete a payment
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const { id } = params

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const scope = await resolveAdminScope(supabase as any, user.id)
    const { data: profile } = await supabase.from("profiles").select("department").eq("id", user.id).single()
    const dataClient = getServiceRoleClientOrFallback(supabase as any)

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

    const { error } = await dataClient.from("department_payments").delete().eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await writeAuditLog(
      supabase as any,
      {
        action: "delete",
        entityType: "payment",
        entityId: id,
        context: { actorId: user.id, source: "api", route: `/api/payments/${id}` },
      },
      { failOpen: true }
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
  }
}
