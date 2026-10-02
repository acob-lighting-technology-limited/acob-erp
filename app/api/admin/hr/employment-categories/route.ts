import { NextRequest, NextResponse } from "next/server"
import { requireAdminRole } from "@/lib/admin/require-admin-role"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { z } from "zod"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { logger } from "@/lib/logger"

const log = logger("admin-employment-categories")
export const dynamic = "force-dynamic"

const CategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(2).max(10).toUpperCase(),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).default(0),
})

const CategoryPatchSchema = CategorySchema.extend({
  id: z.string().uuid(),
})

function ensureAdmin(request: NextRequest) {
  return requireAdminRole(request, "hr.main", "admin-employment-categories", 30)
}

/** GET /api/admin/hr/employment-categories — list all categories */
export async function GET(request: NextRequest) {
  // Reading the category list is needed by leads too (they approve applicants in
  // their department); create/update stay admin-only below.
  const scopeResult = await requireApiAdminScope()
  if (!scopeResult.ok) return scopeResult.response
  if (!scopeResult.scope.isAdminLike && !scopeResult.scope.isDepartmentLead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const auth = { supabase: scopeResult.supabase }

  const includeInactive = request.nextUrl.searchParams.get("include_inactive") === "true"
  const dataClient = getServiceRoleClientOrFallback(auth.supabase)

  let query = dataClient
    .from("contract_categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
  if (!includeInactive) query = query.eq("is_active", true)

  const { data, error } = await query
  if (error) {
    log.error({ err: String(error) }, "Failed to fetch categories")
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 })
  }
  return NextResponse.json({ data: data || [] })
}

/** POST /api/admin/hr/employment-categories — create a category */
export async function POST(request: NextRequest) {
  const auth = await ensureAdmin(request)
  if ("error" in auth) return auth.error

  const parsed = CategorySchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }

  const dataClient = getServiceRoleClientOrFallback(auth.supabase)
  const { data: created, error } = await dataClient
    .from("contract_categories")
    .insert({ ...parsed.data })
    .select()
    .single()

  if (error) {
    log.error({ err: String(error) }, "Failed to create category")
    return NextResponse.json({ error: `Failed to create category: ${error.message}` }, { status: 500 })
  }
  return NextResponse.json({ data: created, message: "Category created" }, { status: 201 })
}

/** PATCH /api/admin/hr/employment-categories — update a category */
export async function PATCH(request: NextRequest) {
  const auth = await ensureAdmin(request)
  if ("error" in auth) return auth.error

  const parsed = CategoryPatchSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }

  const { id, ...updateData } = parsed.data
  const dataClient = getServiceRoleClientOrFallback(auth.supabase)
  const { data: updated, error } = await dataClient
    .from("contract_categories")
    .update(updateData)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    log.error({ err: String(error) }, "Failed to update category")
    return NextResponse.json({ error: `Failed to update category: ${error.message}` }, { status: 500 })
  }
  return NextResponse.json({ data: updated, message: "Category updated" })
}
