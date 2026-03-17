import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { resolveAdminScope } from "@/lib/admin/rbac"
import { logger } from "@/lib/logger"
import { writeAuditLog } from "@/lib/audit/write-audit"

const log = logger("payments-categories")

export const dynamic = "force-dynamic"

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

// PUT /api/payments/categories/[id] - Update a payment category
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()

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

    const { data: category, error } = await supabase
      .from("payment_categories")
      .update({ name })
      .eq("id", params.id)
      .select()
      .single()

    if (error) throw error

    await writeAuditLog(
      supabase as any,
      {
        action: "update",
        entityType: "payment_category",
        entityId: params.id,
        newValues: { name },
        context: { actorId: user.id, source: "api", route: `/api/payments/categories/${params.id}` },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data: category })
  } catch (error) {
    log.error({ err: String(error) }, "Error updating payment category:")
    return NextResponse.json({ error: "Failed to update payment category" }, { status: 500 })
  }
}

// DELETE /api/payments/categories/[id] - Delete a payment category
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()

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

    const { error } = await supabase.from("payment_categories").delete().eq("id", params.id)

    if (error) throw error

    await writeAuditLog(
      supabase as any,
      {
        action: "delete",
        entityType: "payment_category",
        entityId: params.id,
        context: { actorId: user.id, source: "api", route: `/api/payments/categories/${params.id}` },
      },
      { failOpen: true }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    log.error({ err: String(error) }, "Error deleting payment category:")
    return NextResponse.json({ error: "Failed to delete payment category" }, { status: 500 })
  }
}
