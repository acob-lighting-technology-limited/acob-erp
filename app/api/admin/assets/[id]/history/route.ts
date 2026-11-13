import { NextRequest, NextResponse } from "next/server"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { denyUnlessAssetInScope } from "@/lib/admin/target-scope"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { serverError } from "@/lib/api/errors"
import { fetchAssetHistory } from "@/lib/assets/asset-history-query"
import { logger } from "@/lib/logger"

const log = logger("api/admin/assets/id/history")

export const dynamic = "force-dynamic"

// One asset's raw history rows, for its expanded-row timeline and the History sheet. The client
// builds the timeline with buildAssetActivities (formatting/sorting is presentational).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const scopeResult = await requireApiAdminScope()
  if (!scopeResult.ok) return scopeResult.response
  const { scope, supabase } = scopeResult
  if (!scope.isAdminLike && !scope.isDepartmentLead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id: assetId } = await params
  const db = getServiceRoleClientOrFallback(supabase)
  const denied = await denyUnlessAssetInScope(db, scope, assetId)
  if (denied) return denied

  const { data, error } = await fetchAssetHistory(db, [assetId])
  if (error) return serverError(log, error)
  return NextResponse.json(data)
}
