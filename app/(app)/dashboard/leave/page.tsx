import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { LeaveContent } from "./leave-content"

export interface LeaveRequest {
  id: string
  leave_type_id: string
  start_date: string
  end_date: string
  days_count: number
  reason: string
  status: string
  created_at: string
  leave_type: {
    name: string
  }
}

export interface LeaveBalance {
  leave_type_id: string
  allocated_days: number
  used_days: number
  balance_days: number
  leave_type: {
    name: string
  }
}

export interface LeaveType {
  id: string
  name: string
  max_days: number
}

async function getLeaveData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  // Fetch leave requests
  const { data: requestsData } = await supabase
    .from("leave_requests")
    .select(
      `
      *,
      leave_type:leave_types(name)
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20)

  // Fetch leave balances
  const { data: balancesData } = await supabase
    .from("leave_balances")
    .select(
      `
      *,
      leave_type:leave_types(name)
    `
    )
    .eq("user_id", user.id)

  // Fetch leave types
  const { data: typesData } = await supabase.from("leave_types").select("id, name, max_days").eq("is_active", true)

  return {
    requests: (requestsData || []) as LeaveRequest[],
    balances: (balancesData || []) as LeaveBalance[],
    leaveTypes: (typesData || []) as LeaveType[],
  }
}

export default async function LeavePage() {
  const data = await getLeaveData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const leaveData = data as {
    requests: LeaveRequest[]
    balances: LeaveBalance[]
    leaveTypes: LeaveType[]
  }

  return (
    <LeaveContent
      initialRequests={leaveData.requests}
      initialBalances={leaveData.balances}
      initialLeaveTypes={leaveData.leaveTypes}
    />
  )
}
