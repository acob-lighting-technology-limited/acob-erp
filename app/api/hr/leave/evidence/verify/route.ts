import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { areRequiredDocumentsVerified, getLeavePolicy, notifyUsers } from "@/lib/hr/leave-workflow"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (!["admin", "super_admin"].includes(profile?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { evidence_id, status, notes } = body

    if (!evidence_id || !["verified", "rejected"].includes(status)) {
      return NextResponse.json({ error: "evidence_id and valid status are required" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("leave_evidence")
      .update({ status, notes: notes || null, verified_by: user.id, verified_at: new Date().toISOString() })
      .eq("id", evidence_id)
      .select("*")
      .single()

    if (error || !data) return NextResponse.json({ error: "Failed to verify evidence" }, { status: 500 })

    const { data: leaveRequest } = await supabase
      .from("leave_requests")
      .select("id, status, leave_type_id, reliever_id, supervisor_id")
      .eq("id", data.leave_request_id)
      .single()

    if (leaveRequest) {
      const policy = await getLeavePolicy(supabase, leaveRequest.leave_type_id)
      const requiredDocs = policy.required_documents || []
      const evidenceStatus = await areRequiredDocumentsVerified(supabase, leaveRequest.id, requiredDocs)

      if (leaveRequest.status === "pending_evidence" && evidenceStatus.complete) {
        await supabase.from("leave_requests").update({ status: "pending" }).eq("id", leaveRequest.id)

        await notifyUsers(supabase, {
          userIds: [leaveRequest.reliever_id, leaveRequest.supervisor_id].filter(Boolean),
          title: "Leave request ready for approval",
          message: "Evidence has been verified and the leave request is now ready for workflow approvals.",
          actorId: user.id,
          linkUrl: "/dashboard/leave",
          entityId: leaveRequest.id,
        })
      }
    }

    return NextResponse.json({ data, message: `Evidence ${status}` })
  } catch (error) {
    console.error("Error in POST /api/hr/leave/evidence/verify:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "An error occurred" }, { status: 500 })
  }
}
