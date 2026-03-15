import { NextRequest, NextResponse } from "next/server"
import { canAccessAdminSection, resolveAdminScope } from "@/lib/admin/rbac"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { writeAuditLog } from "@/lib/audit/write-audit"

interface CreateAssetTypePayload {
  label?: string
  code?: string
  requiresSerialModel?: boolean
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const scope = await resolveAdminScope(supabase as any, user.id)
  if (!scope || !canAccessAdminSection(scope, "assets")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const dataClient = getServiceRoleClientOrFallback(supabase as any)
  let { data, error } = await dataClient
    .from("asset_types")
    .select("id, label, code, requires_serial_model")
    .order("label", {
      ascending: true,
    })

  if (error && dataClient !== supabase) {
    const fallback = await supabase
      .from("asset_types")
      .select("id, label, code, requires_serial_model")
      .order("label", { ascending: true })
    data = fallback.data
    error = fallback.error
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data || [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const scope = await resolveAdminScope(supabase as any, user.id)
  if (!scope || !scope.isAdminLike || !canAccessAdminSection(scope, "assets")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const payload = (await request.json().catch(() => null)) as CreateAssetTypePayload | null
  const label = String(payload?.label || "").trim()
  const code = String(payload?.code || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
  const requiresSerialModel = Boolean(payload?.requiresSerialModel)

  if (!label || !code) {
    return NextResponse.json({ error: "Both label and code are required" }, { status: 400 })
  }

  const dataClient = getServiceRoleClientOrFallback(supabase as any)
  const { data, error } = await dataClient
    .from("asset_types")
    .insert({
      label,
      code,
      requires_serial_model: requiresSerialModel,
      created_by: user.id,
    })
    .select("id, label, code, requires_serial_model")
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Asset type already exists", code: error.code }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await writeAuditLog(
    supabase,
    {
      action: "create",
      entityType: "asset_type",
      entityId: data.id,
      newValues: { label, code, requires_serial_model: requiresSerialModel },
      context: { actorId: user.id, source: "api", route: "/api/admin/assets/types" },
    },
    { failOpen: true }
  )

  return NextResponse.json({ data }, { status: 201 })
}
