import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { GoalsContent } from "./goals-content"

import { logger } from "@/lib/logger"

const log = logger("dashboard-goals")

export interface Goal {
  id: string
  title: string
  description: string
  target_value: number
  achieved_value: number
  status: string
  priority: string
  due_date: string
  created_at: string
  review_cycle_id?: string | null
  // PMS: approval workflow
  approval_status: "pending" | "approved" | "rejected"
  approved_by?: string | null
  approved_at?: string | null
  department?: string | null
  cycle?: {
    name: string
  } | null
}

async function getGoalsData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("department")
    .eq("id", user.id)
    .maybeSingle<{ department?: string | null }>()

  const { data: cycles } = await supabase
    .from("review_cycles")
    .select("id, name")
    .order("start_date", { ascending: false })
    .returns<Array<{ id: string; name: string }>>()

  const cyclesById = new Map((cycles || []).map((cycle) => [cycle.id, cycle]))

  const { data: goals, error } = profile?.department
    ? await supabase
        .from("goals_objectives")
        .select("*")
        .eq("department", profile.department)
        .order("created_at", { ascending: false })
    : { data: [], error: null }

  if (error) {
    log.error("Error loading goals:", error)
  }

  return {
    goals: ((goals || []) as Goal[]).map((goal) => ({
      ...goal,
      cycle: goal.review_cycle_id ? cyclesById.get(goal.review_cycle_id) || null : null,
    })),
    department: profile?.department || null,
  }
}

export default async function GoalsPage() {
  const data = await getGoalsData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const goalsData = data as { goals: Goal[]; department: string | null }

  return (
    <GoalsContent
      initialGoals={goalsData.goals}
      canCreateGoal={false}
      summaryCards={[
        { label: "Department", value: goalsData.department || "-" },
        { label: "Total Goals", value: goalsData.goals.length },
        {
          label: "Approved Goals",
          value: goalsData.goals.filter((goal) => goal.approval_status === "approved").length,
        },
      ]}
      pageTitle="Department Goals"
      pageDescription={
        goalsData.department
          ? `Goals for ${goalsData.department}. Department leads create goals from the admin PMS side.`
          : "Department leads create goals from the admin PMS side."
      }
      backHref="/pms"
      backLabel="Back to PMS"
    />
  )
}
