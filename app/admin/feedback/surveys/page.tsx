import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { resolveAdminScope } from "@/lib/admin/rbac"
import { SurveyAnalyticsContent } from "./survey-analytics-content"

export const metadata = {
  title: "System Satisfaction Surveys | Admin | ACOB Matrix ERP",
  description: "View post-deployment user satisfaction, speed ratings, and usability feedback.",
}

export default async function AdminSurveysPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/auth/login")
  }

  const scope = await resolveAdminScope(supabase, user.id)
  if (!scope || !scope.isAdminLike) {
    redirect("/profile")
  }

  return <SurveyAnalyticsContent />
}
