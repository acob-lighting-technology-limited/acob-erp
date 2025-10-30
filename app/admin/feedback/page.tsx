import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { FeedbackViewer } from "@/components/feedback-viewer"

export default async function AdminFeedbackPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  // Check if user is admin
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", data.user.id).single()

  if (!profile?.is_admin) {
    redirect("/dashboard")
  }

  // Fetch all feedback
  const { data: feedbackData, error: feedbackError } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false })

  if (feedbackError) {
    console.error("Error fetching feedback:", feedbackError)
  }

  // Fetch profiles for all user_ids in feedback
  let feedbackWithProfiles = feedbackData || []
  if (feedbackData && feedbackData.length > 0) {
    const userIds = Array.from(new Set(feedbackData.map((f) => f.user_id).filter(Boolean)))
    
    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, company_email")
        .in("id", userIds)

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError)
      }

      // Merge profiles with feedback
      feedbackWithProfiles = feedbackData.map((fb) => ({
        ...fb,
        profiles: profilesData?.find((p) => p.id === fb.user_id) || null,
      }))
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">User Feedback</h1>
          <p className="text-muted-foreground">View and manage user concerns, complaints, and suggestions</p>
        </div>

        <FeedbackViewer feedback={feedbackWithProfiles || []} />
      </div>
    </div>
  )
}
