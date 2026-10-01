import { NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { requireAccessContextV2, enforceRouteAccessV2 } from "@/lib/admin/api-guard-v2"
import { listArchivedDays, NETWORK_LOG_RETENTION_MONTHS } from "@/lib/security/network-log-archive"

const log = logger("admin-security-network-activity")
export const dynamic = "force-dynamic"

/** Archived network-log days held in SharePoint — org-wide, admin-only (security.networkActivity). */
export async function GET() {
  const accessResult = await requireAccessContextV2()
  if (!accessResult.ok) return accessResult.response
  const enforceResult = enforceRouteAccessV2(accessResult.context, "security.networkActivity")
  if (!enforceResult.ok) return enforceResult.response

  try {
    const days = await listArchivedDays()
    return NextResponse.json({ data: { days, retentionMonths: NETWORK_LOG_RETENTION_MONTHS } })
  } catch (error) {
    log.error({ err: String(error) }, "Failed to list archived network log days")
    return NextResponse.json({ error: "Could not reach the SharePoint archive" }, { status: 502 })
  }
}
