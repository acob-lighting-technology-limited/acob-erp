import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import type { EmploymentStatus } from "@/types/database"

// Force dynamic rendering to allow cookies/auth
export const dynamic = "force-dynamic"

interface StatusUpdateBody {
  status: EmploymentStatus
  reason?: string
  suspension_end_date?: string
  termination_date?: string
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { id: employeeId } = await params

    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if current user has admin/super_admin role
    const { data: currentUserProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (!currentUserProfile || !["admin", "super_admin"].includes(currentUserProfile.role)) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
    }

    // Prevent users from changing their own status
    if (employeeId === user.id) {
      return NextResponse.json({ error: "Cannot change your own employment status" }, { status: 400 })
    }

    const body: StatusUpdateBody = await request.json()
    const { status, reason, suspension_end_date, termination_date } = body

    // Validate status
    const validStatuses: EmploymentStatus[] = ["active", "suspended", "terminated", "on_leave"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    // Get current employee status for audit
    const { data: currentEmployee } = await supabase
      .from("profiles")
      .select("employment_status, first_name, last_name")
      .eq("id", employeeId)
      .single()

    if (!currentEmployee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    const oldStatus = currentEmployee.employment_status

    // Update profile with new status
    const updateData: Record<string, unknown> = {
      employment_status: status,
      status_changed_at: new Date().toISOString(),
      status_changed_by: user.id,
      updated_at: new Date().toISOString(),
    }

    // Add termination details if terminating
    if (status === "terminated") {
      updateData.termination_date = termination_date || new Date().toISOString().split("T")[0]
      updateData.termination_reason = reason
    } else {
      // Clear termination fields if not terminated
      updateData.termination_date = null
      updateData.termination_reason = null
    }

    const { error: updateError } = await supabase.from("profiles").update(updateData).eq("id", employeeId)

    if (updateError) {
      console.error("Error updating employee status:", updateError)
      return NextResponse.json({ error: "Failed to update status" }, { status: 500 })
    }

    // If suspending, create a suspension record
    if (status === "suspended") {
      const { error: suspensionError } = await supabase.from("employee_suspensions").insert({
        employee_id: employeeId,
        suspended_by: user.id,
        reason: reason || "No reason provided",
        start_date: new Date().toISOString().split("T")[0],
        end_date: suspension_end_date || null,
        is_active: true,
      })

      if (suspensionError) {
        console.error("Error creating suspension record:", suspensionError)
        // Status was updated, but suspension record failed - log but don't fail the request
      }
    }

    // If changing from suspended to active, lift the suspension
    if (oldStatus === "suspended" && status === "active") {
      const { error: liftError } = await supabase
        .from("employee_suspensions")
        .update({
          is_active: false,
          lifted_by: user.id,
          lifted_at: new Date().toISOString(),
          lift_reason: reason || "Suspension lifted",
        })
        .eq("employee_id", employeeId)
        .eq("is_active", true)

      if (liftError) {
        console.error("Error lifting suspension:", liftError)
      }
    }

    // Create audit log entry
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "employee_status_change",
      entity_type: "profile",
      entity_id: employeeId,
      old_values: { employment_status: oldStatus },
      new_values: {
        employment_status: status,
        reason,
        ...(status === "suspended" && suspension_end_date && { suspension_end_date }),
        ...(status === "terminated" && termination_date && { termination_date }),
      },
    })

    return NextResponse.json({
      success: true,
      message: `Employee status updated to ${status}`,
      employee: {
        id: employeeId,
        name: `${currentEmployee.first_name} ${currentEmployee.last_name}`,
        old_status: oldStatus,
        new_status: status,
      },
    })
  } catch (error) {
    console.error("Error in status update:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { id: employeeId } = await params

    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get employee status
    const { data: employee, error } = await supabase
      .from("profiles")
      .select("employment_status, status_changed_at, status_changed_by, termination_date, termination_reason")
      .eq("id", employeeId)
      .single()

    if (error || !employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    // If suspended, get active suspension details
    let suspension = null
    if (employee.employment_status === "suspended") {
      const { data: suspensionData } = await supabase
        .from("employee_suspensions")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      suspension = suspensionData
    }

    return NextResponse.json({
      employment_status: employee.employment_status,
      status_changed_at: employee.status_changed_at,
      status_changed_by: employee.status_changed_by,
      termination_date: employee.termination_date,
      termination_reason: employee.termination_reason,
      suspension,
    })
  } catch (error) {
    console.error("Error fetching status:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
