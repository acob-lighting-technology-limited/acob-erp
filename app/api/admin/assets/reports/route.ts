import { NextResponse } from "next/server"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { listAssetIdsInScope } from "@/lib/admin/target-scope"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { serverError } from "@/lib/api/errors"
import type { AssetReport } from "@/lib/assets/asset-reports"
import { logger } from "@/lib/logger"

const log = logger("api/admin/assets/reports")

export const dynamic = "force-dynamic"

type ReportRow = Omit<
  AssetReport,
  "reported_by_name" | "resolved_by_name" | "unique_code" | "asset_type" | "asset_model" | "assignment_current"
> & { resolved_by: string | null }

/**
 * Problems staff reported from /accounts/assets, for the assets page's Reports tab: open ones first,
 * then the rest, newest first. A department lead gets only reports on assets in their scope.
 */
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
  if (assetIds && assetIds.length === 0) return NextResponse.json({ data: [] })

  let query = db
    .from("asset_reports")
    .select(
      "id, asset_id, assignment_id, kind, note, status, resolution_note, released, created_at, resolved_at, reported_by, resolved_by"
    )
    .order("created_at", { ascending: false })
    .limit(1000)
  if (assetIds) query = query.in("asset_id", assetIds)
  const { data, error } = await query
  if (error) return serverError(log, error)
  const rows = (data ?? []) as ReportRow[]
  if (rows.length === 0) return NextResponse.json({ data: [] })

  const userIds = Array.from(new Set(rows.flatMap((r) => [r.reported_by, r.resolved_by]).filter(Boolean))) as string[]
  const assignmentIds = Array.from(new Set(rows.map((r) => r.assignment_id).filter(Boolean))) as string[]
  const [usersRes, assetsRes, assignmentsRes] = await Promise.all([
    db.from("profiles").select("id, full_name").in("id", userIds),
    db
      .from("assets")
      .select("id, unique_code, asset_type, asset_model")
      .in("id", Array.from(new Set(rows.map((r) => r.asset_id)))),
    assignmentIds.length
      ? db.from("asset_assignments").select("id, is_current").in("id", assignmentIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  const failed = usersRes.error || assetsRes.error || assignmentsRes.error
  if (failed) return serverError(log, failed)

  const names = new Map(((usersRes.data ?? []) as { id: string; full_name: string | null }[]).map((u) => [u.id, u]))
  const assets = new Map(
    (
      (assetsRes.data ?? []) as { id: string; unique_code: string; asset_type: string; asset_model: string | null }[]
    ).map((a) => [a.id, a])
  )
  const current = new Map(
    ((assignmentsRes.data ?? []) as { id: string; is_current: boolean | null }[]).map((a) => [
      a.id,
      Boolean(a.is_current),
    ])
  )

  const reports: AssetReport[] = rows.map(({ resolved_by, ...row }) => {
    const asset = assets.get(row.asset_id)
    return {
      ...row,
      reported_by_name: names.get(row.reported_by)?.full_name || "Unknown",
      resolved_by_name: resolved_by ? names.get(resolved_by)?.full_name || "Unknown" : null,
      unique_code: asset?.unique_code ?? "—",
      asset_type: asset?.asset_type ?? "",
      asset_model: asset?.asset_model ?? null,
      assignment_current: row.assignment_id ? (current.get(row.assignment_id) ?? false) : false,
    }
  })
  // Open reports first: they are the work.
  reports.sort((a, b) => Number(b.status === "open") - Number(a.status === "open"))
  return NextResponse.json({ data: reports })
}
