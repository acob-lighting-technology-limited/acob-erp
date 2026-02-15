import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const userId = searchParams.get("user_id")

    let query = supabase
      .from("leave_requests")
      .select(
        `
        *,
        user:profiles!leave_requests_user_id_fkey (
          id,
          first_name,
          last_name,
          full_name,
          company_email,
          department_id
        ),
        leave_type:leave_types!leave_requests_leave_type_id_fkey (
          id,
          name,
          description,
          max_days
        ),
        approvals:leave_approvals (
          id,
          approver_id,
          approval_level,
          status,
          comments,
          approved_at,
          approver:profiles!leave_approvals_approver_id_fkey (
            id,
            first_name,
            last_name,
            full_name
          )
        )
      `
      )
      .order("created_at", { ascending: false })

    // Apply filters
    if (status) {
      query = query.eq("status", status)
    }

    if (userId) {
      query = query.eq("user_id", userId)
    }

    const { data: requests, error } = await query

    if (error) {
      console.error("Error fetching leave requests:", error)
      return NextResponse.json({ error: "Failed to fetch leave requests" }, { status: 500 })
    }

    return NextResponse.json({ data: requests })
  } catch (error) {
    console.error("Error in GET /api/hr/leave/requests:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { leave_type_id, start_date, end_date, reason } = body

    // Validate required fields
    if (!leave_type_id || !start_date || !end_date || !reason) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Calculate days count
    const startDate = new Date(start_date)
    const endDate = new Date(end_date)
    const daysCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

    if (daysCount <= 0) {
      return NextResponse.json({ error: "End date must be after start date" }, { status: 400 })
    }

    // Check leave balance
    const { data: balance } = await supabase
      .from("leave_balances")
      .select("allocated_days, used_days, balance_days")
      .eq("user_id", user.id)
      .eq("leave_type_id", leave_type_id)
      .single()

    if (balance) {
      if (daysCount > balance.balance_days) {
        return NextResponse.json(
          { error: `Insufficient leave balance. You have ${balance.balance_days} days remaining.` },
          { status: 400 }
        )
      }
    }

    // Check for existing pending request
    const { data: existingRequest } = await supabase
      .from("leave_requests")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .single()

    if (existingRequest) {
      return NextResponse.json(
        {
          error:
            "You already have a pending leave request. Please wait for it to be processed or cancel it before submitting a new one.",
        },
        { status: 400 }
      )
    }

    // Create leave request
    const { data: newRequest, error } = await supabase
      .from("leave_requests")
      .insert({
        user_id: user.id,
        leave_type_id,
        start_date,
        end_date,
        days_count: daysCount,
        reason,
        status: "pending",
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating leave request:", error)
      return NextResponse.json({ error: "Failed to create leave request" }, { status: 500 })
    }

    // Notify all admins and super_admins
    const { data: admins } = await supabase.from("profiles").select("id").in("role", ["admin", "super_admin"])

    if (admins && admins.length > 0) {
      const { notifyApprovalRequest } = await import("@/lib/notifications")

      // Get the requester's name
      const { data: requester } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single()

      const requesterName = requester ? `${requester.first_name} ${requester.last_name}` : "Employee"

      // Send notification to each admin (best-effort)
      const notificationResults = await Promise.allSettled(
        admins.map((admin) =>
          notifyApprovalRequest({
            adminId: admin.id,
            requestType: "Leave Request",
            requestBy: user.id,
            requestDetails: `${requesterName} requested ${daysCount} days leave`,
            linkUrl: `/admin/hr/leave?status=pending`,
          })
        )
      )

      notificationResults.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(`Failed to notify admin ${admins[index].id}:`, result.reason)
        }
      })
    }

    return NextResponse.json({
      data: newRequest,
      message: "Leave request created successfully",
    })
  } catch (error) {
    console.error("Error in POST /api/hr/leave/requests:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, leave_type_id, start_date, end_date, reason } = body

    if (!id) {
      return NextResponse.json({ error: "Leave request ID is required" }, { status: 400 })
    }

    // Fetch the existing request to check status and ownership
    const { data: existingRequest, error: fetchError } = await supabase
      .from("leave_requests")
      .select("id, user_id, status")
      .eq("id", id)
      .single()

    if (fetchError || !existingRequest) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 })
    }

    // Check ownership
    if (existingRequest.user_id !== user.id) {
      return NextResponse.json({ error: "You can only edit your own leave requests" }, { status: 403 })
    }

    // Check if request is still pending
    if (existingRequest.status !== "pending") {
      return NextResponse.json({ error: "Only pending leave requests can be edited" }, { status: 400 })
    }

    // Calculate days if dates are provided
    let days_count
    if (start_date && end_date) {
      const startDate = new Date(start_date)
      const endDate = new Date(end_date)
      days_count = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

      if (days_count <= 0) {
        return NextResponse.json({ error: "End date must be after start date" }, { status: 400 })
      }
    }

    // Build update object
    const updates: Record<string, unknown> = {}
    if (leave_type_id) updates.leave_type_id = leave_type_id
    if (start_date) updates.start_date = start_date
    if (end_date) updates.end_date = end_date
    if (reason) updates.reason = reason
    if (days_count) updates.days_count = days_count

    // Update leave request
    const { data: updatedRequest, error } = await supabase
      .from("leave_requests")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating leave request:", error)
      return NextResponse.json({ error: "Failed to update leave request" }, { status: 500 })
    }

    return NextResponse.json({
      data: updatedRequest,
      message: "Leave request updated successfully",
    })
  } catch (error) {
    console.error("Error in PUT /api/hr/leave/requests:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Leave request ID is required" }, { status: 400 })
    }

    // Fetch the existing request to check status and ownership
    const { data: existingRequest, error: fetchError } = await supabase
      .from("leave_requests")
      .select("id, user_id, status")
      .eq("id", id)
      .single()

    if (fetchError || !existingRequest) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 })
    }

    // Check ownership
    if (existingRequest.user_id !== user.id) {
      return NextResponse.json({ error: "You can only delete your own leave requests" }, { status: 403 })
    }

    // Check if request is still pending
    if (existingRequest.status !== "pending") {
      return NextResponse.json({ error: "Only pending leave requests can be deleted" }, { status: 400 })
    }

    // Delete the leave request
    const { error } = await supabase.from("leave_requests").delete().eq("id", id)

    if (error) {
      console.error("Error deleting leave request:", error)
      return NextResponse.json({ error: "Failed to delete leave request" }, { status: 500 })
    }

    return NextResponse.json({
      message: "Leave request deleted successfully",
    })
  } catch (error) {
    console.error("Error in DELETE /api/hr/leave/requests:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
