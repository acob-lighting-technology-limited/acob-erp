import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { getDepartmentScope, resolveAdminScope, normalizeDepartmentName } from "@/lib/admin/rbac"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { logger } from "@/lib/logger"
import { writeAuditLog } from "@/lib/audit/write-audit"

const log = logger("payments")

export const dynamic = "force-dynamic"

type PaymentsClient = Awaited<ReturnType<typeof createClient>>

type UserPaymentsProfile = {
  department?: string | null
  department_id?: string | null
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const normalizeDepartmentId = (value: unknown): string | null => {
  const raw = typeof value === "string" ? value.trim() : ""
  if (!raw || !UUID_REGEX.test(raw)) return null
  return raw
}

// Helper function to create Supabase client
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
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })
}

// GET /api/payments - Get payments (filtered by department if not admin)
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const departmentId = searchParams.get("department_id")
    const paymentType = searchParams.get("payment_type")
    const category = searchParams.get("category")
    const status = searchParams.get("status")

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, department, department_id")
      .eq("id", user.id)
      .single()
    const scope = await resolveAdminScope(supabase, user.id)
    const dataClient = getServiceRoleClientOrFallback(supabase)

    let query = dataClient
      .from("department_payments")
      .select(
        `
                *,
                department:departments(*),
                documents:payment_documents(id, document_type, file_path, file_name, applicable_date)
            `
      )
      .order("created_at", { ascending: false })

    if (scope) {
      const scopedDepartments = getDepartmentScope(scope, "finance")
      if (scopedDepartments && scopedDepartments.length > 0) {
        const { data: deptRows } = await dataClient.from("departments").select("id").in("name", scopedDepartments)
        const deptIds = (deptRows || []).map((row) => row.id)
        query = deptIds.length > 0 ? query.in("department_id", deptIds) : query.eq("department_id", "__none__")
      } else if (scopedDepartments && scopedDepartments.length === 0) {
        query = query.eq("department_id", "__none__")
      } else if (departmentId) {
        query = query.eq("department_id", departmentId)
      }
    } else {
      const deptId = normalizeDepartmentId((profile as UserPaymentsProfile | null)?.department_id)
      if (deptId) {
        query = query.eq("department_id", deptId)
      } else {
        const rawDept = String((profile as UserPaymentsProfile | null)?.department || "").trim()
        const deptCandidates = Array.from(new Set([normalizeDepartmentName(rawDept), rawDept].filter(Boolean)))
        const { data: userDept } = await dataClient
          .from("departments")
          .select("id")
          .in("name", deptCandidates.filter(Boolean))
          .limit(1)
          .maybeSingle()
        query = userDept ? query.eq("department_id", userDept.id) : query.eq("department_id", "__none__")
      }
    }

    // Apply filters
    if (paymentType) {
      query = query.eq("payment_type", paymentType)
    }
    if (category) {
      query = query.eq("category", category)
    }
    if (status) {
      query = query.eq("status", status)
    }

    const { data: payments, error } = await query

    if (error) throw error

    return NextResponse.json({ data: payments })
  } catch (error) {
    log.error({ err: String(error) }, "Error fetching payments:")
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 })
  }
}

// POST /api/payments - Create a new payment
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      department_id,
      payment_type,
      category,
      title,
      description,
      amount,
      currency = "NGN",
      recurrence_period,
      next_payment_due,
      payment_date,
      issuer_name,
      issuer_phone_number,
      issuer_address,
      payment_reference,
      notes,
    } = body

    // Validate required fields - category must be "one-time" or "recurring"
    if (!department_id || !category || !title || !amount || !issuer_name || !issuer_phone_number) {
      return NextResponse.json({ error: "Missing required fields (including Issuer Name & Phone)" }, { status: 400 })
    }

    // Validate category is one of the allowed values
    if (category !== "one-time" && category !== "recurring") {
      return NextResponse.json({ error: "Category must be 'one-time' or 'recurring'" }, { status: 400 })
    }

    // Derive payment_type from category (they are now the same)
    const derivedPaymentType = payment_type || category

    // Validate payment type specific fields
    if (derivedPaymentType === "recurring" && (!recurrence_period || !next_payment_due)) {
      return NextResponse.json(
        { error: "Recurring payments require recurrence_period and next_payment_due" },
        { status: 400 }
      )
    }

    if (derivedPaymentType === "one-time" && !payment_date) {
      return NextResponse.json({ error: "One-time payments require payment_date" }, { status: 400 })
    }

    // Note: Categories are now fixed ("one-time" or "recurring"), no need to auto-create

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, department, department_id")
      .eq("id", user.id)
      .single()
    const scope = await resolveAdminScope(supabase, user.id)
    const dataClient = getServiceRoleClientOrFallback(supabase)

    if (scope) {
      const scopedDepartments = getDepartmentScope(scope, "finance")
      if (scopedDepartments) {
        const { data: targetDepartment } = await dataClient
          .from("departments")
          .select("name")
          .eq("id", department_id)
          .single()
        if (!targetDepartment || !scopedDepartments.includes(targetDepartment.name)) {
          return NextResponse.json(
            { error: "You can only create finance records in your scoped departments" },
            { status: 403 }
          )
        }
      }
    } else {
      let userDepartmentId = normalizeDepartmentId((profile as UserPaymentsProfile | null)?.department_id)
      if (!userDepartmentId) {
        const rawDept = String((profile as UserPaymentsProfile | null)?.department || "").trim()
        const deptCandidates = Array.from(new Set([normalizeDepartmentName(rawDept), rawDept].filter(Boolean)))
        const { data: userDept } = await dataClient
          .from("departments")
          .select("id")
          .in("name", deptCandidates.filter(Boolean))
          .limit(1)
          .maybeSingle()
        userDepartmentId = userDept?.id || null
      }
      if (!userDepartmentId || userDepartmentId !== department_id) {
        return NextResponse.json({ error: "You can only create payments in your own department" }, { status: 403 })
      }
    }

    // Create payment
    const { data: payment, error } = await dataClient
      .from("department_payments")
      .insert({
        department_id,
        payment_type: derivedPaymentType,
        category,
        title,
        description,
        amount,
        currency,
        status: derivedPaymentType === "one-time" ? "paid" : "due", // One-time payments are already paid
        recurrence_period: derivedPaymentType === "recurring" ? recurrence_period : null,
        next_payment_due: derivedPaymentType === "recurring" ? next_payment_due : null,
        payment_date: derivedPaymentType === "one-time" ? payment_date : null,
        issuer_name,
        issuer_phone_number,
        issuer_address,
        payment_reference,
        notes,
        created_by: user.id,
      })
      .select(
        `
                *,
                department:departments(*)
            `
      )
      .single()

    if (error) throw error

    await writeAuditLog(
      supabase as PaymentsClient,
      {
        action: "create",
        entityType: "payment",
        entityId: payment.id,
        newValues: { amount: payment.amount, department_id: payment.department_id, status: payment.status },
        context: { actorId: user.id, source: "api", route: "/api/payments" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data: payment }, { status: 201 })
  } catch (error: unknown) {
    log.error({ err: String(error) }, "Error creating payment:")
    const message = error instanceof Error ? error.message : "Failed to create payment"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
