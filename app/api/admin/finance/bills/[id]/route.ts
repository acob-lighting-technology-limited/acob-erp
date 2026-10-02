import { NextRequest, NextResponse } from "next/server"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { serverError } from "@/lib/api/errors"
import { logger } from "@/lib/logger"

const log = logger("api/admin/finance/bills/id")

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const scopeResult = await requireApiAdminScope()
  if (!scopeResult.ok) return scopeResult.response
  const { scope, supabase } = scopeResult
  if (!scope.isAdminLike) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const db = getServiceRoleClientOrFallback(supabase)
  const { data, error } = await db.from("bills").select("*, items:bill_items(*)").eq("id", id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

// Mark-as-paid only (the only mutation the bill detail page performs).
export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const scopeResult = await requireApiAdminScope()
  if (!scopeResult.ok) return scopeResult.response
  const { scope, supabase } = scopeResult
  if (!scope.isAdminLike) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const db = getServiceRoleClientOrFallback(supabase)
  const { error } = await db.from("bills").update({ status: "paid" }).eq("id", id)
  if (error) return serverError(log, error)
  return NextResponse.json({ ok: true })
}
