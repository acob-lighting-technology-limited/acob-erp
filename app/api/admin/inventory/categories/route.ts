import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { serverError } from "@/lib/api/errors"
import { logger } from "@/lib/logger"

const log = logger("api/admin/inventory/categories")

export const dynamic = "force-dynamic"

const CategorySchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
})

export async function GET() {
  const scopeResult = await requireApiAdminScope()
  if (!scopeResult.ok) return scopeResult.response
  const { scope, supabase } = scopeResult
  if (!scope.isAdminLike) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = getServiceRoleClientOrFallback(supabase)
  const { data, error } = await db.from("product_categories").select("*").order("name")
  if (error) {
    if (error.code === "42P01") return NextResponse.json({ data: [] })
    return serverError(log, error)
  }

  const categoriesWithCounts = await Promise.all(
    (data ?? []).map(async (category) => {
      const { count } = await db
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("category_id", (category as { id: string }).id)
      return { ...(category as Record<string, unknown>), product_count: count || 0 }
    })
  )

  return NextResponse.json({ data: categoriesWithCounts })
}

export async function POST(request: NextRequest) {
  const scopeResult = await requireApiAdminScope()
  if (!scopeResult.ok) return scopeResult.response
  const { scope, supabase } = scopeResult
  if (!scope.isAdminLike) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const parsed = CategorySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 })
  }
  const db = getServiceRoleClientOrFallback(supabase)
  const { error } = await db
    .from("product_categories")
    .insert({ name: parsed.data.name, description: parsed.data.description || null })
  if (error) return serverError(log, error)
  return NextResponse.json({ ok: true })
}
