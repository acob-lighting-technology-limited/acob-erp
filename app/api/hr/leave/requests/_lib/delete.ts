/** DELETE /api/hr/leave/requests (split from route.ts, audit 5.10). */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { formatLeaveReference, notifyUsers } from "@/lib/hr/leave-workflow"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { log } from "./shared"

export async function DELETE(request: NextRequest) {
  const rl = await rateLimit(`hr-leave-requests:${getClientId(request)}`, { limit: 15, windowSec: 60 })
  if (!rl.allowed)
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      { status: 429 }
    )
  try {
    const supabase = await createClient()
    const dataClient = getServiceRoleClientOrFallback(supabase)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = request.nextUrl
    const id = searchParams.get("id")

    if (!id) return NextResponse.json({ error: "Leave request ID is required" }, { status: 400 })

    const { data: existingRequest, error: fetchError } = await supabase
      .from("leave_requests")
      .select(
        "id, user_id, reliever_id, start_date, end_date, leave_type_id, status, approval_stage, current_stage_code"
      )
      .eq("id", id)
      .single()

    if (fetchError || !existingRequest) return NextResponse.json({ error: "Leave request not found" }, { status: 404 })

    if (existingRequest.user_id !== user.id) {
      return NextResponse.json({ error: "You can only delete your own leave requests" }, { status: 403 })
    }

    const normalizedStatus = String(existingRequest.status || "").toLowerCase()
    if (!["pending", "pending_evidence"].includes(normalizedStatus)) {
      return NextResponse.json({ error: "Only pending leave requests can be deleted" }, { status: 400 })
    }

    const { data: deletedRows, error } = await dataClient.from("leave_requests").delete().eq("id", id).select("id")
    if (error) return NextResponse.json({ error: "Failed to delete leave request" }, { status: 500 })
    if (!deletedRows || deletedRows.length === 0) {
      return NextResponse.json(
        { error: "Leave request could not be deleted. Please refresh and try again." },
        { status: 409 }
      )
    }

    await writeAuditLog(
      supabase,
      {
        action: "delete",
        entityType: "leave_request",
        entityId: id,
        oldValues: { status: existingRequest.status, stage: existingRequest.current_stage_code },
        context: { actorId: user.id, source: "api", route: "/api/hr/leave/requests" },
      },
      { failOpen: true }
    )

    if (existingRequest.reliever_id && existingRequest.reliever_id !== user.id) {
      const ref = formatLeaveReference(id)
      const refSuffix = ref ? ` — ${ref}` : ""
      const { data: callerProfile } = await supabase
        .from("profiles")
        .select("full_name, first_name, last_name, company_email")
        .eq("id", user.id)
        .maybeSingle()
      const callerName =
        callerProfile?.full_name ||
        `${callerProfile?.first_name || ""} ${callerProfile?.last_name || ""}`.trim() ||
        callerProfile?.company_email ||
        "Employee"

      await notifyUsers(dataClient, {
        userIds: [existingRequest.reliever_id],
        title: "Leave request cancelled",
        message: `${callerName} cancelled their pending leave request (${existingRequest.start_date} to ${existingRequest.end_date}). Your reliever commitment has been released.`,
        actorId: user.id,
        linkUrl: "/hr/leave",
        entityId: id,
        emailEvent: "approval_required",
        emailSubject: `Reliever Duty Released — ${callerName}${refSuffix}`,
        emailTitle: "Reliever Duty Released",
        badgeText: "Request Cancelled",
        badgeVariant: "info",
        detailsTitle: "Cancelled Request Details",
        details: [
          { label: "Employee", value: callerName },
          { label: "Period", value: `${existingRequest.start_date} to ${existingRequest.end_date}` },
          { label: "Status", value: "Cancelled by Requester (Relief Released)" },
        ],
        ctaLabel: "Open Leave Portal",
      })
    }

    return NextResponse.json({ message: "Leave request deleted successfully" })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in DELETE")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
