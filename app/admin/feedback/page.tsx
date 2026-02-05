import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { FeedbackViewerClient } from "@/components/feedback-viewer-client"
import { MessageSquare, AlertCircle, Clock, CheckCircle, XCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader, PageWrapper } from "@/components/layout"

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
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="User Feedback"
        description="View and manage user concerns, complaints, and suggestions"
        icon={MessageSquare}
        backLink={{ href: "/admin", label: "Back to Admin" }}
      />

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="border-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-sm font-medium">Total</p>
                <p className="text-foreground mt-1 text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="ml-2 shrink-0 rounded-lg bg-blue-100 p-2.5 dark:bg-blue-900/30">
                <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-sm font-medium">Open</p>
                <p className="text-foreground mt-1 text-2xl font-bold">{stats.open}</p>
              </div>
              <div className="ml-2 flex-shrink-0 rounded-lg bg-green-100 p-2.5 dark:bg-green-900/30">
                <AlertCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-sm font-medium">In Progress</p>
                <p className="text-foreground mt-1 text-2xl font-bold">{stats.inProgress}</p>
              </div>
              <div className="ml-2 flex-shrink-0 rounded-lg bg-blue-100 p-2.5 dark:bg-blue-900/30">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-sm font-medium">Resolved</p>
                <p className="text-foreground mt-1 text-2xl font-bold">{stats.resolved}</p>
              </div>
              <div className="ml-2 flex-shrink-0 rounded-lg bg-purple-100 p-2.5 dark:bg-purple-900/30">
                <CheckCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-sm font-medium">Closed</p>
                <p className="text-foreground mt-1 text-2xl font-bold">{stats.closed}</p>
              </div>
              <div className="ml-2 flex-shrink-0 rounded-lg bg-gray-100 p-2.5 dark:bg-gray-900/30">
                <XCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feedback List */}
      <FeedbackViewerClient feedback={feedbackWithProfiles || []} />
    </PageWrapper>
  )
}
