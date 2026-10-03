import { NextRequest, NextResponse } from "next/server"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { serverError, validationError } from "@/lib/api/errors"
import { SupplierSchema } from "@/lib/purchasing/schemas"
import { logger } from "@/lib/logger"

const log = logger("api/admin/purchasing/suppliers/id")

export const dynamic = "force-dynamic"

// Supplier detail + last 10 purchase orders.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const scopeResult = await requireApiAdminScope()
  if (!scopeResult.ok) return scopeResult.response
  const { scope, supabase } = scopeResult
  if (!scope.isAdminLike) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const db = getServiceRoleClientOrFallback(supabase)

  const [{ data: supplier, error: supError }, { data: orders }] = await Promise.all([
    db.from("suppliers").select("*").eq("id", id).single(),
    db
      .from("purchase_orders")
      .select("id, po_number, order_date, total_amount, status")
      .eq("supplier_id", id)
      .order("order_date", { ascending: false })
      .limit(10),
  ])

  if (supError || !supplier) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
  }
  return NextResponse.json({ data: { supplier, orders: orders ?? [] } })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const scopeResult = await requireApiAdminScope()
  if (!scopeResult.ok) return scopeResult.response
  const { scope, supabase } = scopeResult
  if (!scope.isAdminLike) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const parsed = SupplierSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error.issues)
  const db = getServiceRoleClientOrFallback(supabase)
  const { name, code, email, phone, address, contact_person, is_active } = parsed.data
  const { error } = await db
    .from("suppliers")
    .update({
      name,
      code,
      email: email || null,
      phone: phone || null,
      address: address || null,
      contact_person: contact_person || null,
      is_active,
    })
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
  const { error } = await db.from("suppliers").delete().eq("id", id)
  if (error) return serverError(log, error)
  return NextResponse.json({ ok: true })
}
