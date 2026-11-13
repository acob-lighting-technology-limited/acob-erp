import { NextResponse } from "next/server"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { listAssetIdsInScope } from "@/lib/admin/target-scope"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { serverError } from "@/lib/api/errors"
import { fetchAssetHistory } from "@/lib/assets/asset-history-query"
import { logger } from "@/lib/logger"

const log = logger("api/admin/assets/history")

export const dynamic = "force-dynamic"

// Raw history rows for every asset the viewer can see, for the assets page's History tab.
// A department lead gets only the assets in their scope (the same reach as the assets list).
// There are a few hundred events in all, so it returns everything and the table filters.
export async function GET() {
  const scopeResult = await requireApiAdminScope()
  if (!scopeResult.ok) return scopeResult.response
  const { scope, supabase } = scopeResult
  if (!scope.isAdminLike && !scope.isDepartmentLead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const db = getServiceRoleClientOrFallback(supabase)
  let assetIds: string[] | null
  try {
    assetIds = await listAssetIdsInScope(db, scope)
  } catch (error) {
    return serverError(log, error)
  }

  const { data, error } = await fetchAssetHistory(db, assetIds)
  if (error) return serverError(log, error)
  return NextResponse.json(data)
}
