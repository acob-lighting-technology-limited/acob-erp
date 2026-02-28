import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { resolveAdminScope } from "@/lib/admin/rbac"

export const dynamic = "force-dynamic"

// Helper function to create Supabase client
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
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })
}

// GET /api/payments/categories - Get all payment categories
export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const scope = await resolveAdminScope(supabase as any, user.id)
    if (!scope) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: categories, error } = await supabase.from("payment_categories").select("*").order("name")

    if (error) throw error

    return NextResponse.json({ data: categories })
  } catch (error) {
    console.error("Error fetching payment categories:", error)
    return NextResponse.json({ error: "Failed to fetch payment categories" }, { status: 500 })
  }
}

// POST /api/payments/categories - Create a new payment category
export async function POST(request: Request) {
  try {
    const supabase = createClient()

    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const scope = await resolveAdminScope(supabase as any, user.id)
    if (!scope || !scope.isAdminLike) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { name } = body

    if (!name) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 })
    }

    const { data: category, error } = await supabase.from("payment_categories").insert({ name }).select().single()

    if (error) throw error

    return NextResponse.json({ data: category }, { status: 201 })
  } catch (error) {
    console.error("Error creating payment category:", error)
    return NextResponse.json({ error: "Failed to create payment category" }, { status: 500 })
  }
}
