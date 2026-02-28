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

    const body = await request.json()
    const { leave_request_id, document_type, file_url, notes } = body

    if (!leave_request_id || !document_type || !file_url) {
      return NextResponse.json({ error: "leave_request_id, document_type and file_url are required" }, { status: 400 })
    }

    const { data: leaveRequest } = await supabase
      .from("leave_requests")
      .select("id, user_id, leave_type_id, reliever_id, supervisor_id, status")
      .eq("id", leave_request_id)
      .single()

    if (!leaveRequest) return NextResponse.json({ error: "Leave request not found" }, { status: 404 })
    if (leaveRequest.user_id !== user.id) {
      return NextResponse.json({ error: "You can only upload evidence for your own request" }, { status: 403 })
    }

    const { data: evidence, error } = await supabase
      .from("leave_evidence")
      .insert({
        leave_request_id,
        document_type,
        file_url,
        uploaded_by: user.id,
        notes: notes || null,
        status: "pending",
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: "Failed to upload evidence" }, { status: 500 })

    const policy = await getLeavePolicy(supabase, leaveRequest.leave_type_id)
    const requiredDocs = policy.required_documents || []
    const evidenceStatus = await areRequiredDocumentsVerified(supabase, leave_request_id, requiredDocs)

    if (leaveRequest.status === "pending_evidence" && evidenceStatus.complete) {
      await supabase.from("leave_requests").update({ status: "pending" }).eq("id", leave_request_id)

      await notifyUsers(supabase, {
        userIds: [leaveRequest.reliever_id, leaveRequest.supervisor_id].filter(Boolean),
        title: "Leave request ready for approval",
        message: "Required evidence has been completed. The leave request has entered approval workflow.",
        actorId: user.id,
        linkUrl: "/dashboard/leave",
        entityId: leave_request_id,
      })
    }

    return NextResponse.json({ data: evidence, message: "Evidence uploaded successfully" })
  } catch (error) {
    console.error("Error in POST /api/hr/leave/evidence:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "An error occurred" }, { status: 500 })
  }
}
