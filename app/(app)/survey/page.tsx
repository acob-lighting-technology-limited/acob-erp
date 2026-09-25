import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { SystemSurveyPrompt } from "@/components/survey/system-survey-prompt"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function SurveyPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data?.user) {
    redirect("/auth/login")
  }

  const dataClient = getServiceRoleClientOrFallback(supabase)
  const { data: existingSurvey } = await dataClient
    .from("system_satisfaction_surveys")
    .select("id")
    .eq("user_id", data.user.id)
    .maybeSingle()

  const hasCompletedSurvey = Boolean(existingSurvey)

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8">
      <p className="text-muted-foreground text-sm">
        {hasCompletedSurvey
          ? "You have already completed the survey. Thank you!"
          : "Survey prompt should appear automatically..."}
      </p>
      <SystemSurveyPrompt hasCompletedSurvey={hasCompletedSurvey} />
    </div>
  )
}
