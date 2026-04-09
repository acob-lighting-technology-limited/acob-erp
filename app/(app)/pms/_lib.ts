import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { computeIndividualPerformanceScore } from "@/lib/performance/scoring"

type ProfileRow = {
  id: string
  first_name: string | null
  last_name: string | null
  department: string | null
}

type AttendanceRow = {
  id: string
  date: string
  clock_in: string | null
  clock_out: string | null
  total_hours: number | null
  status: string | null
}

type ReviewRow = {
  id: string
  created_at: string
  status: string | null
  final_score: number | null
}

type GoalRow = {
  id: string
  approval_status: string | null
  status: string | null
}

export type IndividualPmsScore = Awaited<ReturnType<typeof computeIndividualPerformanceScore>>

export async function getCurrentUserPmsData() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  const [{ data: profile }, { data: goals }, { data: attendance }, { data: latestReview }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, first_name, last_name, department")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>(),
    supabase.from("goals_objectives").select("id, approval_status, status").eq("user_id", user.id).returns<GoalRow[]>(),
    supabase
      .from("attendance_records")
      .select("id, date, clock_in, clock_out, total_hours, status")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(10)
      .returns<AttendanceRow[]>(),
    supabase
      .from("performance_reviews")
      .select("id, created_at, status, final_score")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .returns<ReviewRow[]>(),
  ])

  const score = await computeIndividualPerformanceScore(supabase, { userId: user.id })

  const goalRows = goals || []
  const recentAttendance = attendance || []

  return {
    profile,
    score,
    goalSummary: {
      total: goalRows.length,
      approved: goalRows.filter((goal) => goal.approval_status === "approved").length,
      completed: goalRows.filter((goal) => goal.status === "completed").length,
    },
    attendance: {
      recent: recentAttendance,
      presentDays: recentAttendance.filter((record) =>
        ["present", "wfh", "remote"].includes(String(record.status || "").toLowerCase())
      ).length,
      trackedDays: recentAttendance.length,
    },
    latestReview: latestReview?.[0] ?? null,
  }
}
