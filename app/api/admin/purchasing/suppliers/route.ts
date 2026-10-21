import { NextRequest, NextResponse } from "next/server"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { serverError, validationError } from "@/lib/api/errors"
import { SupplierSchema } from "@/lib/purchasing/schemas"
import { logger } from "@/lib/logger"

const log = logger("api/admin/purchasing/suppliers")

export const dynamic = "force-dynamic"

// `?options=1` returns a lightweight active-suppliers list for the PO form dialog.
export async function GET(request: NextRequest) {
  const scopeResult = await requireApiAdminScope()
  if (!scopeResult.ok) return scopeResult.response
  const { scope, supabase } = scopeResult
  if (!scope.isAdminLike) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = getServiceRoleClientOrFallback(supabase)
  const options = request.nextUrl.searchParams.get("options") === "1"

  if (options) {
    const { data, error } = await db.from("suppliers").select("id, name, code").eq("is_active", true).order("name")
    if (error) return serverError(log, error)
    return NextResponse.json({ data: data ?? [] })
  }

  const { data, error } = await db.from("suppliers").select("*").order("name")
  if (error) return serverError(log, error)
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest) {
  const scopeResult = await requireApiAdminScope()
  if (!scopeResult.ok) return scopeResult.response
  const { scope, supabase } = scopeResult
  if (!scope.isAdminLike) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const parsed = SupplierSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error.issues)
  const db = getServiceRoleClientOrFallback(supabase)
  const { name, code, email, phone, address, contact_person, is_active } = parsed.data
  const { error } = await db.from("suppliers").insert({
    name,
    code,
    email: email || null,
    phone: phone || null,
    address: address || null,
    contact_person: contact_person || null,
    is_active,
  })
  if (error) return serverError(log, error)
  return NextResponse.json({ ok: true })
}
