import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { evaluateLeaveEligibility, getLeavePolicy } from "@/lib/hr/leave-workflow"
import { LeaveContent } from "./leave-content"

export interface LeaveRequest {
  id: string
  leave_type_id: string
  start_date: string
  end_date: string
  resume_date: string
  days_count: number
  reason: string
  status: string
  approval_stage: string
  created_at: string
  leave_type: {
    name: string
  }
  required_documents?: string[]
  missing_documents?: string[]
  evidence_complete?: boolean
}

export interface LeaveBalance {
  leave_type_id: string
  allocated_days: number
  used_days: number
  balance_days: number
}

export interface LeaveType {
  id: string
  name: string
  code: string
  max_days: number
  eligibility_status: "eligible" | "not_eligible" | "missing_evidence"
  eligibility_reason: string | null
  required_documents: string[]
  missing_documents: string[]
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

  const [{ data: requestsData }, { data: balancesData }, { data: leaveTypes }, { data: profileData }] =
    await Promise.all([
      supabase
        .from("leave_requests")
        .select(
          `
        *,
        leave_type:leave_types(name)
      `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("leave_balances")
        .select("leave_type_id, allocated_days, used_days, balance_days")
        .eq("user_id", user.id),
      supabase.from("leave_types").select("id, name, code, max_days").eq("is_active", true).order("name"),
      supabase
        .from("profiles")
        .select(
          "id, gender, employment_date, employment_type, marital_status, has_children, pregnancy_status, work_location"
        )
        .eq("id", user.id)
        .single(),
    ])

  const requesterProfile = profileData || {
    id: user.id,
    gender: "unspecified",
    employment_date: null,
    employment_type: null,
    marital_status: "unspecified",
    has_children: false,
    pregnancy_status: "unspecified",
  }

  const enrichedLeaveTypes = await Promise.all(
    (leaveTypes || []).map(async (leaveType: { id: string; name: string; code: string; max_days: number }) => {
      const policy = await getLeavePolicy(supabase, leaveType.id)
      const eligibility = await evaluateLeaveEligibility({
        supabase,
        policy,
        requesterProfile,
        leaveType,
        startDate: new Date().toISOString().slice(0, 10),
        daysCount: 1,
      })

      return {
        ...leaveType,
        eligibility_status: eligibility.status,
        eligibility_reason: eligibility.reason,
        required_documents: eligibility.requiredDocuments,
        missing_documents: eligibility.missingDocuments,
      }
    })
  )

  return {
    requests: (requestsData || []) as LeaveRequest[],
    balances: (balancesData || []) as LeaveBalance[],
    leaveTypes: enrichedLeaveTypes as LeaveType[],
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
