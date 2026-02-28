import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  LEAVE_PENDING_STAGES,
  addDays,
  parseISODate,
  syncAttendanceForApprovedLeave,
  toISODate,
} from "@/lib/hr/leave-workflow"

async function restoreBalance(supabase: any, userId: string, leaveTypeId: string, days: number) {
  const currentYear = new Date().getUTCFullYear()

  const { data: balance } = await supabase
    .from("leave_balances")
    .select("id, used_days")
    .eq("user_id", userId)
    .eq("leave_type_id", leaveTypeId)
    .eq("year", currentYear)
    .single()

  if (!balance) return

  await supabase
    .from("leave_balances")
    .update({ used_days: Math.max(0, Number(balance.used_days || 0) - days) })
    .eq("id", balance.id)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { leave_request_id, action, reason, extension_days, early_return_date } = body

    if (!leave_request_id || !action) {
      return NextResponse.json({ error: "leave_request_id and action are required" }, { status: 400 })
    }

    const { data: actorProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    const isHR = ["admin", "super_admin"].includes(actorProfile?.role)

    const { data: leaveRequest, error: fetchError } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("id", leave_request_id)
      .single()

    if (fetchError || !leaveRequest) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 })
    }

    if (action === "withdraw") {
      if (leaveRequest.user_id !== user.id) {
        return NextResponse.json({ error: "Only requester can withdraw leave" }, { status: 403 })
      }

      if (leaveRequest.status !== "pending") {
        return NextResponse.json({ error: "Only pending leave requests can be withdrawn" }, { status: 400 })
      }

      await supabase
        .from("leave_requests")
        .update({
          status: "cancelled",
          approval_stage: "cancelled",
          rejected_reason: reason || "Withdrawn by requester",
        })
        .eq("id", leave_request_id)

      return NextResponse.json({ message: "Leave request withdrawn" })
    }

    if (action === "cancel") {
      const canCancel = leaveRequest.user_id === user.id || isHR
      if (!canCancel) {
        return NextResponse.json({ error: "Only requester or HR can cancel approved leave" }, { status: 403 })
      }

      if (leaveRequest.status !== "approved") {
        return NextResponse.json({ error: "Only approved leave can be cancelled" }, { status: 400 })
      }

      const todayIso = toISODate(new Date())
      if (leaveRequest.start_date <= todayIso && !isHR) {
        return NextResponse.json({ error: "You can only cancel leave before it starts" }, { status: 400 })
      }

      await supabase
        .from("leave_requests")
        .update({ status: "cancelled", approval_stage: "cancelled", rejected_reason: reason || "Cancelled" })
        .eq("id", leave_request_id)

      await restoreBalance(supabase, leaveRequest.user_id, leaveRequest.leave_type_id, leaveRequest.days_count)
      await syncAttendanceForApprovedLeave(
        supabase,
        leaveRequest.user_id,
        leaveRequest.start_date,
        leaveRequest.end_date,
        "clear"
      )

      return NextResponse.json({ message: "Approved leave cancelled" })
    }

    if (action === "extend") {
      if (leaveRequest.user_id !== user.id) {
        return NextResponse.json({ error: "Only requester can request extension" }, { status: 403 })
      }

      const days = Number(extension_days)
      if (!days || days <= 0) {
        return NextResponse.json({ error: "Valid extension_days is required" }, { status: 400 })
      }

      const extensionStart = addDays(parseISODate(leaveRequest.end_date), 1)
      const extensionEnd = addDays(extensionStart, days - 1)
      const resumeDate = addDays(extensionEnd, 1)

      const { data: extensionRequest, error: extensionError } = await supabase
        .from("leave_requests")
        .insert({
          user_id: leaveRequest.user_id,
          leave_type_id: leaveRequest.leave_type_id,
          start_date: toISODate(extensionStart),
          end_date: toISODate(extensionEnd),
          resume_date: toISODate(resumeDate),
          days_count: days,
          reason: reason || `Extension request linked to ${leaveRequest.id}`,
          status: "pending",
          approval_stage: LEAVE_PENDING_STAGES.RELIEVER,
          reliever_id: leaveRequest.reliever_id,
          supervisor_id: leaveRequest.supervisor_id,
          handover_note: leaveRequest.handover_note,
          handover_checklist_url: leaveRequest.handover_checklist_url,
          requested_days_mode: leaveRequest.requested_days_mode || "calendar_days",
          original_request_id: leaveRequest.id,
          request_kind: "extension",
        })
        .select("id")
        .single()

      if (extensionError || !extensionRequest) {
        return NextResponse.json({ error: "Failed to create extension request" }, { status: 500 })
      }

      return NextResponse.json({ message: "Extension request submitted", data: extensionRequest })
    }

    if (action === "early_return") {
      if (!isHR) {
        return NextResponse.json({ error: "Only HR can process early return" }, { status: 403 })
      }

      if (leaveRequest.status !== "approved") {
        return NextResponse.json({ error: "Early return applies to approved leave only" }, { status: 400 })
      }

      if (!early_return_date) {
        return NextResponse.json({ error: "early_return_date is required" }, { status: 400 })
      }

      const earlyDate = parseISODate(early_return_date)
      const startDate = parseISODate(leaveRequest.start_date)
      const originalEnd = parseISODate(leaveRequest.end_date)

      if (earlyDate < startDate || earlyDate > originalEnd) {
        return NextResponse.json({ error: "early_return_date must be within leave period" }, { status: 400 })
      }

      const newEndDate = toISODate(earlyDate)
      const newResumeDate = toISODate(addDays(earlyDate, 1))
      const newDaysCount = Math.floor((earlyDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
      const delta = leaveRequest.days_count - newDaysCount

      await supabase
        .from("leave_requests")
        .update({
          end_date: newEndDate,
          resume_date: newResumeDate,
          days_count: newDaysCount,
          hr_comment: reason || "Early return processed by HR",
        })
        .eq("id", leave_request_id)

      if (delta > 0) {
        await restoreBalance(supabase, leaveRequest.user_id, leaveRequest.leave_type_id, delta)
        const clearFrom = toISODate(addDays(earlyDate, 1))
        await syncAttendanceForApprovedLeave(supabase, leaveRequest.user_id, clearFrom, leaveRequest.end_date, "clear")
      }

      return NextResponse.json({ message: "Early return processed" })
    }

    return NextResponse.json({ error: "Unsupported lifecycle action" }, { status: 400 })
  } catch (error) {
    console.error("Error in POST /api/hr/leave/lifecycle:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "An error occurred" }, { status: 500 })
  }
}
