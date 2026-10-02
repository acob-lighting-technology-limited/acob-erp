import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { serverError } from "@/lib/api/errors"
import { logger } from "@/lib/logger"

const log = logger("api/admin/inventory/warehouses/id")

export const dynamic = "force-dynamic"

const WarehouseSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().min(1),
  address: z.string().trim().optional().nullable(),
  is_active: z.boolean(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const scopeResult = await requireApiAdminScope()
  if (!scopeResult.ok) return scopeResult.response
  const { scope, supabase } = scopeResult
  if (!scope.isAdminLike) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const parsed = WarehouseSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 })
  }
  const db = getServiceRoleClientOrFallback(supabase)
  const { name, code, address, is_active } = parsed.data
  const { error } = await db
    .from("warehouses")
    .update({ name, code, address: address || null, is_active })
    .eq("id", id)
  if (error) return serverError(log, error)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const scopeResult = await requireApiAdminScope()
  if (!scopeResult.ok) return scopeResult.response
  const { scope, supabase } = scopeResult
  if (!scope.isAdminLike) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const db = getServiceRoleClientOrFallback(supabase)
  const { error } = await db.from("warehouses").delete().eq("id", id)
  if (error) return serverError(log, error)
  return NextResponse.json({ ok: true })
}
