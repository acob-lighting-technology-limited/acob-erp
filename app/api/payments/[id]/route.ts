import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

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

    const { data: payment, error } = await supabase
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

    // Check permissions (Admin or Department Member)
    const { data: profile } = await supabase.from("profiles").select("is_admin, department").eq("id", user.id).single()

    if (!profile?.is_admin) {
      // Check if payment belongs to user's department
      const { data: payment } = await supabase
        .from("department_payments")
        .select("department:departments(name), created_by")
        .eq("id", id)
        .single()

      // @ts-expect-error: Payment relation typing issue
      const paymentDept = payment?.department?.name
      const userDept = profile?.department

      if (paymentDept !== userDept) {
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
    }

    const { data: updatedPayment, error } = await supabase
      .from("department_payments")
      .update(body)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

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

    // Check permissions
    const { data: profile } = await supabase.from("profiles").select("is_admin, department").eq("id", user.id).single()

    if (!profile?.is_admin) {
      // Non-admins can only delete their own payments
      const { data: payment } = await supabase.from("department_payments").select("created_by").eq("id", id).single()

      if (!payment || payment.created_by !== user.id) {
        return NextResponse.json({ error: "Forbidden: You can only delete payments you created" }, { status: 403 })
      }
    }

    const { error } = await supabase.from("department_payments").delete().eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
  }
}
