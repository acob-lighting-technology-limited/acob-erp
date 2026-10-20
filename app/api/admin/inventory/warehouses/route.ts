import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { serverError } from "@/lib/api/errors"
import { logger } from "@/lib/logger"

const log = logger("api/admin/inventory/warehouses")

export const dynamic = "force-dynamic"

const WarehouseSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().min(1),
  address: z.string().trim().optional().nullable(),
  is_active: z.boolean(),
})

export async function GET() {
  const scopeResult = await requireApiAdminScope()
  if (!scopeResult.ok) return scopeResult.response
  const { scope, supabase } = scopeResult
  if (!scope.isAdminLike) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = getServiceRoleClientOrFallback(supabase)
  const { data, error } = await db.from("warehouses").select("*").order("name")
  if (error) {
    if (error.code === "42P01") return NextResponse.json({ data: [] })
    return serverError(log, error)
  }
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest) {
  const scopeResult = await requireApiAdminScope()
  if (!scopeResult.ok) return scopeResult.response
  const { scope, supabase } = scopeResult
  if (!scope.isAdminLike) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const parsed = WarehouseSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 })
  }
  const db = getServiceRoleClientOrFallback(supabase)
  const { name, code, address, is_active } = parsed.data
  const { error } = await db.from("warehouses").insert({ name, code, address: address || null, is_active })
  if (error) return serverError(log, error)
  return NextResponse.json({ ok: true })
}
