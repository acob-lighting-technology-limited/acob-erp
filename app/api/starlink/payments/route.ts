import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * @deprecated This endpoint is deprecated. Use /api/payments?category=Starlink instead.
 * Starlink payments have been consolidated into the department_payments system.
 * This endpoint now redirects to the new unified payment system.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // DEPRECATED: Redirect to new consolidated payment system
    // Fetch from department_payments with Starlink category instead
    let query = supabase
      .from("department_payments")
      .select(
        `
        *,
        department:departments (
          id,
          name
        )
      `
      )
      .eq("category", "Starlink")
      .order("next_payment_due", { ascending: false })

    const { data: payments, error } = await query

    if (error) {
      console.error("Error fetching starlink payments:", error)
      return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 })
    }

    return NextResponse.json({
      data: payments,
      _deprecation: {
        message: "This endpoint is deprecated. Use /api/payments?category=Starlink instead.",
        migrationDate: "2026-01-04",
        newEndpoint: "/api/payments?category=Starlink",
      },
    })
  } catch (error) {
    console.error("Error in GET /api/starlink/payments:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

/**
 * @deprecated This endpoint is deprecated. Use POST /api/payments with category='Starlink' instead.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check user role
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (!profile || !["super_admin", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(
      {
        error: 'This endpoint is deprecated. Please use POST /api/payments with category="Starlink" instead.',
        _deprecation: {
          message: "This endpoint is deprecated. Use POST /api/payments instead.",
          migrationDate: "2026-01-04",
          newEndpoint: "/api/payments",
        },
      },
      { status: 410 } // 410 Gone
    )
  } catch (error) {
    console.error("Error in POST /api/starlink/payments:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

/**
 * @deprecated This endpoint is deprecated. Use PUT /api/payments/{id} instead.
 */
export async function PUT(request: NextRequest) {
  return NextResponse.json(
    {
      error: "This endpoint is deprecated. Please use PUT /api/payments/{id} instead.",
      _deprecation: {
        message: "This endpoint is deprecated. Use PUT /api/payments/{id} instead.",
        migrationDate: "2026-01-04",
        newEndpoint: "/api/payments/{id}",
      },
    },
    { status: 410 } // 410 Gone
  )
}

/**
 * @deprecated This endpoint is deprecated. Use DELETE /api/payments?id={id} instead.
 */
export async function DELETE(request: NextRequest) {
  return NextResponse.json(
    {
      error: "This endpoint is deprecated. Please use DELETE /api/payments?id={id} instead.",
      _deprecation: {
        message: "This endpoint is deprecated. Use DELETE /api/payments?id={id} instead.",
        migrationDate: "2026-01-04",
        newEndpoint: "/api/payments?id={id}",
      },
    },
    { status: 410 } // 410 Gone
  )
}
