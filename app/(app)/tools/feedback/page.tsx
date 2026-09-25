import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { FeedbackContent } from "./feedback-content"

export interface Feedback {
  id: string
  user_id?: string | null
  is_anonymous?: boolean | null
  feedback_type: string
  title: string
  description: string | null
  status: string
  priority?: string
  created_at: string
}

async function getFeedbackData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  const { data: feedback } = await supabase
    .from("feedback")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const { data: survey } = await supabase
    .from("system_satisfaction_surveys")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  return {
    userFeedback: feedback || [],
    userSurvey: survey || null,
  }
}

export default async function FeedbackPage() {
  const data = await getFeedbackData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const feedbackData = data as {
    userFeedback: Feedback[]
    userSurvey: import("@/types/survey").SystemSatisfactionSurvey | null
  }

  return <FeedbackContent initialFeedback={feedbackData.userFeedback} initialSurvey={feedbackData.userSurvey} />
}
