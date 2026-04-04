import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { computeIndividualPerformanceScore } from "@/lib/performance/scoring"

const log = logger("hr-performance-score")

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
    const targetUserId = searchParams.get("user_id") || user.id
    const cycleId = searchParams.get("cycle_id")

    if (targetUserId !== user.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_department_lead")
        .eq("id", user.id)
        .single()

      if (!profile || (!["developer", "admin", "super_admin"].includes(profile.role) && !profile.is_department_lead)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const score = await computeIndividualPerformanceScore(supabase, { userId: targetUserId, cycleId })

    return NextResponse.json({ data: score })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in GET /api/hr/performance/score")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
