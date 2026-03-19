import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { FeedbackViewerClient } from "@/components/feedback-viewer-client"
import { getDepartmentScope, resolveAdminScope } from "@/lib/admin/rbac"
import { MessageSquare, AlertCircle, Clock, CheckCircle, XCircle } from "lucide-react"
import { StatCard } from "@/components/ui/stat-card"
import { PageHeader, PageWrapper } from "@/components/layout"

import { logger } from "@/lib/logger"

const log = logger("feedback")

export default async function AdminFeedbackPage() {
  const supabase = await createClient()
  const dataClient = getServiceRoleClientOrFallback(supabase)

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  const scope = await resolveAdminScope(supabase, data.user.id)
  if (!scope) {
    redirect("/profile")
  }
  const departmentScope = getDepartmentScope(scope, "general")

  let feedbackQuery = dataClient.from("feedback").select("*").order("created_at", { ascending: false })
  if (departmentScope) {
    const { data: scopedUsers } =
      departmentScope.length > 0
        ? await dataClient.from("profiles").select("id").in("department", departmentScope)
        : { data: [] as { id: string }[] }
    const scopedUserIds = (scopedUsers || []).map((row) => row.id)
    feedbackQuery =
      scopedUserIds.length > 0 ? feedbackQuery.in("user_id", scopedUserIds) : feedbackQuery.eq("id", "__none__")
  }

  const { data: feedbackData, error: feedbackError } = await feedbackQuery

  if (feedbackError) {
    log.error("Error fetching feedback:", feedbackError)
  }

  // Fetch profiles for all user_ids in feedback
  let feedbackWithProfiles = feedbackData || []
  if (feedbackData && feedbackData.length > 0) {
    const userIds = Array.from(new Set(feedbackData.map((f) => f.user_id).filter(Boolean)))

    if (userIds.length > 0) {
      let profilesQuery = dataClient
        .from("profiles")
        .select("id, first_name, last_name, company_email, department")
        .in("id", userIds)
      if (departmentScope) {
        profilesQuery =
          departmentScope.length > 0
            ? profilesQuery.in("department", departmentScope)
            : profilesQuery.eq("id", "__none__")
      }
      const { data: profilesData, error: profilesError } = await profilesQuery

      if (profilesError) {
        log.error("Error fetching profiles:", profilesError)
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
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-5 md:gap-4">
        <StatCard title="Total" value={stats.total} icon={MessageSquare} />
        <StatCard
          title="Open"
          value={stats.open}
          icon={AlertCircle}
          iconBgColor="bg-green-100 dark:bg-green-900/30"
          iconColor="text-green-600 dark:text-green-400"
        />
        <StatCard
          title="In Progress"
          value={stats.inProgress}
          icon={Clock}
          iconBgColor="bg-blue-100 dark:bg-blue-900/30"
          iconColor="text-blue-600 dark:text-blue-400"
        />
        <StatCard
          title="Resolved"
          value={stats.resolved}
          icon={CheckCircle}
          iconBgColor="bg-purple-100 dark:bg-purple-900/30"
          iconColor="text-purple-600 dark:text-purple-400"
        />
        <StatCard
          title="Closed"
          value={stats.closed}
          icon={XCircle}
          iconBgColor="bg-gray-100 dark:bg-gray-900/30"
          iconColor="text-gray-600 dark:text-gray-400"
        />
      </div>

      {/* Feedback List */}
      <FeedbackViewerClient feedback={feedbackWithProfiles || []} />
    </PageWrapper>
  )
}
