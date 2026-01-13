import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { GoalsContent } from "./goals-content"

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

  // Fetch user's goals
  const { data: goals, error } = await supabase
    .from("performance_goals")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error loading goals:", error)
  }

  return {
    goals: (goals || []) as Goal[],
    userId: user.id,
  }
}

export default async function GoalsPage() {
  const data = await getGoalsData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const goalsData = data as { goals: Goal[]; userId: string }

  return <GoalsContent initialGoals={goalsData.goals} userId={goalsData.userId} />
}
