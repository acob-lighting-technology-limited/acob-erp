import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { denyUnlessAssetInScope } from "@/lib/admin/target-scope"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { parseJsonBody } from "@/lib/api/parse-body"
import { serverError } from "@/lib/api/errors"
import { ASSET_REPORT_KIND_LABELS, CUSTODY_REPORT_KINDS, type AssetRecordReportKind } from "@/lib/assets/asset-reports"
import { notifyAssetUsers } from "@/lib/assets/asset-notify"
import { logger } from "@/lib/logger"

const log = logger("api/admin/assets/reports/id")

export const dynamic = "force-dynamic"

const ParamsSchema = z.object({ id: z.string().uuid() })

const DecisionSchema = z
  .object({
    outcome: z.enum(["resolved", "rejected"]),
    note: z.string().trim().max(2000).optional().default(""),
    /** Release the asset as part of resolving (only for "I don't have it" reports). */
    release: z.boolean().optional().default(false),
  })
  .refine((body) => body.outcome !== "rejected" || body.note.length >= 3, {
    message: "Say why you are rejecting it, so the person knows",
    path: ["note"],
  })

/**
 * An asset admin resolves or rejects a staff report. Resolving an "I don't have it" report can
 * release the asset in the same step, which only happens here, after a person has checked: a report
 * never clears an asset off someone's name by itself.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const scopeResult = await requireApiAdminScope()
  if (!scopeResult.ok) return scopeResult.response
  const { scope, supabase } = scopeResult
  if (!scope.isAdminLike && !scope.isDepartmentLead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const parsedParams = ParamsSchema.safeParse(await params)
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid report" }, { status: 400 })
  const parsed = await parseJsonBody(request, DecisionSchema)
  if (!parsed.ok) return parsed.response
  const { outcome, note, release } = parsed.data

  const db = getServiceRoleClientOrFallback(supabase)
  const { data, error } = await db
    .from("asset_reports")
    .select("id, asset_id, assignment_id, reported_by, kind, status")
    .eq("id", parsedParams.data.id)
    .maybeSingle()
  if (error) return serverError(log, error)
  const report = data as {
    id: string
    asset_id: string
    assignment_id: string | null
    reported_by: string
    kind: AssetRecordReportKind
    status: string
  } | null
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 })
  const denied = await denyUnlessAssetInScope(db, scope, report.asset_id)
  if (denied) return denied
  if (report.status !== "open") {
    return NextResponse.json({ error: "This report has already been decided" }, { status: 409 })
  }

  let released = false
  if (outcome === "resolved" && release) {
    if (!CUSTODY_REPORT_KINDS.has(report.kind)) {
      return NextResponse.json(
        { error: "Only a report that the person does not have it can release it" },
        { status: 400 }
      )
    }
    // Release only if the reporter still holds it: the asset may have moved on since.
    const { data: assignment } = report.assignment_id
      ? await db.from("asset_assignments").select("is_current").eq("id", report.assignment_id).maybeSingle()
      : { data: null }
    if ((assignment as { is_current: boolean | null } | null)?.is_current) {
      const { error: releaseError } = await db.rpc("release_asset", {
        p_asset_id: report.asset_id,
        p_released_by: scope.userId,
      })
      if (releaseError) return serverError(log, releaseError)
      released = true
    }
  }

  const { error: updateError } = await db
    .from("asset_reports")
    .update({
      status: outcome,
      resolution_note: note || null,
      released,
      resolved_by: scope.userId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", report.id)
    .eq("status", "open")
  if (updateError) return serverError(log, updateError)

  const { data: asset } = await db.from("assets").select("unique_code").eq("id", report.asset_id).maybeSingle()
  const code = (asset as { unique_code: string } | null)?.unique_code ?? "your asset"
  const what = ASSET_REPORT_KIND_LABELS[report.kind].label.toLowerCase()
  await notifyAssetUsers([report.reported_by], {
    type: outcome === "resolved" ? "asset_status_fixed" : "asset_status_alert",
    title: outcome === "resolved" ? `Your report on ${code} was resolved` : `Your report on ${code} was not accepted`,
    message:
      outcome === "resolved"
        ? `Your report (${what}) was resolved${released ? " and the asset is no longer assigned to you" : ""}.${note ? ` Note: "${note}"` : ""}`
        : `Your report (${what}) was not accepted: "${note}". Contact the asset admin if you disagree.`,
    linkUrl: "/accounts/assets",
    actorId: scope.userId,
    entityType: "asset_report",
    entityId: report.id,
  })

  return NextResponse.json({ ok: true, released })
}
