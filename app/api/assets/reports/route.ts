import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { parseJsonBody } from "@/lib/api/parse-body"
import { serverError } from "@/lib/api/errors"
import { ASSET_REPORT_KINDS, ASSET_REPORT_KIND_LABELS } from "@/lib/assets/asset-reports"
import { loadAssetAdminIds, notifyAssetUsers } from "@/lib/assets/asset-notify"
import { assetLabel, loadOwnAssignment } from "@/lib/assets/staff-assignment"
import { logger } from "@/lib/logger"

const log = logger("api/assets/reports")

export const dynamic = "force-dynamic"

const ADMIN_LINK = "/admin/accounts/assets?tab=reports"

const ReportSchema = z
  .object({
    assignment_id: z.string().uuid(),
    kind: z.enum(ASSET_REPORT_KINDS),
    note: z.string().trim().max(2000).optional().default(""),
  })
  .refine((body) => body.kind !== "faulty" || body.note.length >= 5, {
    message: "Describe the fault in a few words",
    path: ["note"],
  })
  .refine((body) => body.kind !== "wrong_details" || body.note.length >= 3, {
    message: "Say which details are wrong",
    path: ["note"],
  })

/**
 * The person holding an asset reports a problem with it from /accounts/assets.
 *
 * A fault becomes an asset issue (the existing Asset issues page). A record problem becomes an
 * asset report for the asset admins; "I didn't receive it" also marks a waiting acceptance as
 * disputed. Nothing here changes who holds the asset: an admin checks and decides, so a report can
 * never clear a lost item off someone's name by itself.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = await parseJsonBody(request, ReportSchema)
  if (!parsed.ok) return parsed.response
  const { assignment_id, kind, note } = parsed.data

  const db = getServiceRoleClientOrFallback(supabase)
  const { row, error } = await loadOwnAssignment(db, assignment_id, user.id)
  if (error) return serverError(log, error)
  if (!row) return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
  if (!row.is_current) {
    return NextResponse.json({ error: "This asset is no longer assigned to you" }, { status: 409 })
  }

  const { data: reporter } = await db.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
  const reporterName = (reporter as { full_name: string | null } | null)?.full_name || "A staff member"
  const label = assetLabel(row)
  const adminIds = (await loadAssetAdminIds(db)).filter((id) => id !== user.id)

  if (kind === "faulty") {
    const { data: issue, error: issueError } = await db
      .from("asset_issues")
      .insert({ asset_id: row.asset_id, description: note, created_by: user.id, resolved: false })
      .select("id")
      .single()
    if (issueError) return serverError(log, issueError)
    await notifyAssetUsers(adminIds, {
      type: "asset_status_alert",
      title: `Fault reported on ${row.asset?.unique_code ?? "an asset"}`,
      message: `${reporterName} reported a fault on ${label}: "${note}"`,
      linkUrl: "/admin/accounts/assets/issues",
      actorId: user.id,
      entityType: "asset_issue",
      entityId: (issue as { id: string }).id,
      priority: "high",
    })
    return NextResponse.json({ ok: true, kind })
  }

  const { data: report, error: reportError } = await db
    .from("asset_reports")
    .insert({
      asset_id: row.asset_id,
      assignment_id: row.id,
      reported_by: user.id,
      kind,
      note: note || null,
    })
    .select("id")
    .single()
  if (reportError) {
    if ((reportError as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "You already have an open report on this asset. An asset admin will get back to you." },
        { status: 409 }
      )
    }
    return serverError(log, reportError)
  }

  if (kind === "not_received" && (row.acceptance_status === "pending" || row.acceptance_status === "auto_accepted")) {
    const { error: disputeError } = await db
      .from("asset_assignments")
      .update({ acceptance_status: "disputed" })
      .eq("id", row.id)
    if (disputeError) log.error({ err: String(disputeError.message) }, "Could not mark the acceptance disputed")
  }

  await notifyAssetUsers(adminIds, {
    type: "asset_status_alert",
    title: `${ASSET_REPORT_KIND_LABELS[kind].label}: ${row.asset?.unique_code ?? "asset"}`,
    message: `${reporterName} reported a problem with ${label}: ${ASSET_REPORT_KIND_LABELS[kind].label.toLowerCase()}${note ? ` - "${note}"` : ""}.`,
    linkUrl: ADMIN_LINK,
    actorId: user.id,
    entityType: "asset_report",
    entityId: (report as { id: string }).id,
    priority: "high",
  })
  return NextResponse.json({ ok: true, kind })
}
