import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { evaluateLeaveEligibility, getLeavePolicy } from "@/lib/hr/leave-workflow"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: requester } = await supabase
      .from("profiles")
      .select(
        "id, full_name, company_email, gender, employment_date, employment_type, marital_status, has_children, pregnancy_status"
      )
      .eq("id", user.id)
      .single()

    if (!requester) return NextResponse.json({ error: "Profile not found" }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const daysCount = Number(searchParams.get("days") || "1")
    const startDate = searchParams.get("start_date") || new Date().toISOString().slice(0, 10)

    const { data: leaveTypes } = await supabase.from("leave_types").select("id, name, code, max_days").order("name")

    const simulations = await Promise.all(
      (leaveTypes || []).map(async (leaveType: any) => {
        const policy = await getLeavePolicy(supabase, leaveType.id)
        const result = await evaluateLeaveEligibility({
          supabase,
          policy,
          requesterProfile: requester,
          leaveType,
          startDate,
          daysCount,
        })

        return {
          leave_type: leaveType,
          policy,
          eligibility_status: result.status,
          eligibility_reason: result.reason,
          required_documents: result.requiredDocuments,
          missing_documents: result.missingDocuments,
        }
      })
    )

    return NextResponse.json({
      employee: {
        id: requester.id,
        full_name: requester.full_name,
        company_email: requester.company_email,
      },
      data: simulations,
    })
  } catch (error) {
    console.error("Error in GET /api/hr/leave/policy-simulation:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "An error occurred" }, { status: 500 })
  }
}
