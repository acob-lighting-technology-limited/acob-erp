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
        .select("department:departments(name)")
        .eq("id", id)
        .single()

      // @ts-expect-error: Payment relation typing issue
      if (payment?.department?.name !== profile.department) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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

    // Only admins can delete payments (enforced by RLS too, but good to check)
    const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Only admins can delete payments" }, { status: 403 })
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
