import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { FeedbackViewerClient } from "@/components/feedback-viewer-client"
import { MessageSquare, AlertCircle, Clock, CheckCircle, XCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export default async function AdminFeedbackPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  // Check if user is admin or lead
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, lead_departments")
    .eq("id", data.user.id)
    .single()

  if (!profile || !["super_admin", "admin", "lead"].includes(profile.role)) {
    redirect("/dashboard")
  }

  // Fetch feedback - RLS will filter by department for leads
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
        .select("id, first_name, last_name, company_email, department")
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

  // Calculate stats
  const stats = {
    total: feedbackWithProfiles.length,
    open: feedbackWithProfiles.filter((f) => f.status === "open").length,
    inProgress: feedbackWithProfiles.filter((f) => f.status === "in_progress").length,
    resolved: feedbackWithProfiles.filter((f) => f.status === "resolved").length,
    closed: feedbackWithProfiles.filter((f) => f.status === "closed").length,
  }

  return (
    <div className="from-background via-background to-muted/20 min-h-screen w-full overflow-x-hidden bg-gradient-to-br">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold sm:gap-3 sm:text-3xl">
              <MessageSquare className="text-primary h-6 w-6 sm:h-8 sm:w-8" />
              User Feedback
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              View and manage user concerns, complaints, and suggestions
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-5 md:gap-4">
          <Card className="border-2">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="xs:text-xs text-muted-foreground truncate text-[10px] font-medium">Total</p>
                  <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">{stats.total}</p>
                </div>
                <div className="ml-1 shrink-0 rounded-lg bg-blue-100 p-1.5 sm:p-2 md:p-3 dark:bg-blue-900/30">
                  <MessageSquare className="h-4 w-4 text-blue-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="xs:text-xs text-muted-foreground truncate text-[10px] font-medium">Open</p>
                  <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">{stats.open}</p>
                </div>
                <div className="ml-1 flex-shrink-0 rounded-lg bg-green-100 p-1.5 sm:p-2 md:p-3 dark:bg-green-900/30">
                  <AlertCircle className="h-4 w-4 text-green-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="xs:text-xs text-muted-foreground truncate text-[10px] font-medium">In Progress</p>
                  <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">
                    {stats.inProgress}
                  </p>
                </div>
                <div className="ml-1 flex-shrink-0 rounded-lg bg-blue-100 p-1.5 sm:p-2 md:p-3 dark:bg-blue-900/30">
                  <Clock className="h-4 w-4 text-blue-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="xs:text-xs text-muted-foreground truncate text-[10px] font-medium">Resolved</p>
                  <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">
                    {stats.resolved}
                  </p>
                </div>
                <div className="ml-1 flex-shrink-0 rounded-lg bg-purple-100 p-1.5 sm:p-2 md:p-3 dark:bg-purple-900/30">
                  <CheckCircle className="h-4 w-4 text-purple-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="xs:text-xs text-muted-foreground truncate text-[10px] font-medium">Closed</p>
                  <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">
                    {stats.closed}
                  </p>
                </div>
                <div className="ml-1 flex-shrink-0 rounded-lg bg-gray-100 p-1.5 sm:p-2 md:p-3 dark:bg-gray-900/30">
                  <XCircle className="h-4 w-4 text-gray-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-gray-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Feedback List */}
        <FeedbackViewerClient feedback={feedbackWithProfiles || []} />
      </div>
    </div>
  )
}
