import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin or department lead
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_department_lead, department_id")
      .eq("id", user.id)
      .single()

    if (!profile || (!["admin", "super_admin"].includes(profile.role) && !profile.is_department_lead)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { leave_request_id, status, comments } = body

    if (!leave_request_id || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (!["approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: 'Invalid status. Must be "approved" or "rejected"' }, { status: 400 })
    }

    // Get the leave request
    const { data: leaveRequest, error: fetchError } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("id", leave_request_id)
      .single()

    if (fetchError || !leaveRequest) {
      console.error("Error fetching leave request:", fetchError)
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 })
    }

    // Get the requester's profile to check department
    const { data: requesterProfile } = await supabase
      .from("profiles")
      .select("department_id")
      .eq("id", leaveRequest.user_id)
      .single()

    // Check if department lead can approve (must be same department)
    if (profile.is_department_lead && !["admin", "super_admin"].includes(profile.role)) {
      if (profile.department_id !== requesterProfile?.department_id) {
        return NextResponse.json({ error: "You can only approve leave requests from your department" }, { status: 403 })
      }
    }

    // Update leave request status
    const { error: updateError } = await supabase
      .from("leave_requests")
      .update({
        status,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        rejected_reason: status === "rejected" ? comments : null,
      })
      .eq("id", leave_request_id)

    if (updateError) {
      console.error("Error updating leave request:", updateError)
      return NextResponse.json({ error: "Failed to update leave request" }, { status: 500 })
    }

    // Create approval record
    const { error: approvalError } = await supabase.from("leave_approvals").insert({
      leave_request_id,
      approver_id: user.id,
      approval_level: 1,
      status,
      comments,
      approved_at: new Date().toISOString(),
    })

    if (approvalError) {
      console.error("Error creating approval record:", approvalError)
    }

    // If approved, update leave balance
    if (status === "approved") {
      const { error: balanceError } = await supabase.rpc("update_leave_balance", {
        p_user_id: leaveRequest.user_id,
        p_leave_type_id: leaveRequest.leave_type_id,
        p_days: leaveRequest.days_count,
      })

      if (balanceError) {
        console.error("Error updating leave balance:", balanceError)
      }
    }

    // Send notification to the user
    const { notifyApprovalGranted, notifyApprovalRejected } = await import("@/lib/notifications")

    if (status === "approved") {
      await notifyApprovalGranted({
        userId: leaveRequest.user_id,
        approvalType: "Leave Request",
        approvedBy: user.id,
        details: `${leaveRequest.days_count} days from ${new Date(leaveRequest.start_date).toLocaleDateString()}`,
        linkUrl: "/portal/leave",
      })
    } else if (status === "rejected") {
      await notifyApprovalRejected({
        userId: leaveRequest.user_id,
        approvalType: "Leave Request",
        rejectedBy: user.id,
        reason: comments || "No reason provided",
        linkUrl: "/portal/leave",
      })
    }

    return NextResponse.json({
      message: `Leave request ${status} successfully`,
    })
  } catch (error) {
    console.error("Error in POST /api/hr/leave/approve:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
