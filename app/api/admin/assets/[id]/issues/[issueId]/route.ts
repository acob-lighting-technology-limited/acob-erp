import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { denyUnlessAssetInScope } from "@/lib/admin/target-scope"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { serverError } from "@/lib/api/errors"
import { logger } from "@/lib/logger"

const log = logger("api/admin/assets/id/issues/issueId")

export const dynamic = "force-dynamic"

const ToggleSchema = z.object({ resolved: z.boolean() })

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; issueId: string }> }) {
  const scopeResult = await requireApiAdminScope()
  if (!scopeResult.ok) return scopeResult.response
  const { scope, supabase } = scopeResult
  if (!scope.isAdminLike && !scope.isDepartmentLead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id: assetId, issueId } = await params
  const parsed = ToggleSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 })
  }
  const db = getServiceRoleClientOrFallback(supabase)
  const denied = await denyUnlessAssetInScope(db, scope, assetId)
  if (denied) return denied
  // The issue must belong to the asset in the URL, or the check above would not cover it.
  const { error } = await db
    .from("asset_issues")
    .update({ resolved: parsed.data.resolved })
    .eq("id", issueId)
    .eq("asset_id", assetId)
  if (error) return serverError(log, error)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; issueId: string }> }) {
  const scopeResult = await requireApiAdminScope()
  if (!scopeResult.ok) return scopeResult.response
  const { scope, supabase } = scopeResult
  if (!scope.isAdminLike && !scope.isDepartmentLead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id: assetId, issueId } = await params
  const db = getServiceRoleClientOrFallback(supabase)
  const denied = await denyUnlessAssetInScope(db, scope, assetId)
  if (denied) return denied
  const { error } = await db.from("asset_issues").delete().eq("id", issueId).eq("asset_id", assetId)
  if (error) return serverError(log, error)
  return NextResponse.json({ ok: true })
}
