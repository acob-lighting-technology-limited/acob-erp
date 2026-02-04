import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { FeedbackContent } from "./feedback-content"

export interface Feedback {
  id: string
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

  return {
    userFeedback: feedback || [],
    userId: user.id,
  }
}

export default async function FeedbackPage() {
  const data = await getFeedbackData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const feedbackData = data as { userFeedback: Feedback[]; userId: string }

  return <FeedbackContent initialFeedback={feedbackData.userFeedback} userId={feedbackData.userId} />
}
