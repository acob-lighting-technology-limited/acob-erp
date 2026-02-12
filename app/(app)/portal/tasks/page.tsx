"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ClipboardList, LayoutDashboard, FileSpreadsheet, FileBarChart, CheckCircle2, Clock, Plus } from "lucide-react"
import Link from "next/link"
import { PageWrapper, PageHeader, Section } from "@/components/layout"
import { StatCard } from "@/components/ui/stat-card"

interface PortalStats {
  assignedTasks: number
  pendingActions: number
  reportsSubmitted: number
}

export default function PortalTasksDashboard() {
  const [stats, setStats] = useState<PortalStats>({
    assignedTasks: 0,
    pendingActions: 0,
    reportsSubmitted: 0,
  })
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, department, role")
        .eq("id", user.id)
        .single()

      setProfile(profileData)

      // Assigned general tasks
      const { count: taskCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("category", "general")
        .or(`assigned_to.eq.${user.id},department.eq.${profileData?.department || ""}`)

      // Pending weekly actions for department
      const { count: actionCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("category", "weekly_action")
        .eq("department", profileData?.department || "")
        .neq("status", "completed")

      // Reports submitted by department
      const { count: reportCount } = await supabase
        .from("weekly_reports")
        .select("*", { count: "exact", head: true })
        .eq("department", profileData?.department || "")
        .eq("status", "submitted")

      setStats({
        assignedTasks: taskCount || 0,
        pendingActions: actionCount || 0,
        reportsSubmitted: reportCount || 0,
      })
    } catch (error) {
      console.error("Portal Dashboard Error:", error)
    } finally {
      setLoading(false)
    }
  }

  const isLeadOrAdmin = profile?.role === "lead" || profile?.role === "admin" || profile?.role === "super_admin"

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Tasks & Reports Hub"
        description="Monitor your tasks and contribute to departmental reporting"
        icon={ClipboardList}
      />

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="My Tasks"
          value={stats.assignedTasks}
          icon={LayoutDashboard}
          description="Invidual and group tasks"
        />
        <StatCard
          title="Dept. Actions"
          value={stats.pendingActions}
          icon={Clock}
          description="Pending weekly actions"
        />
        <StatCard
          title="Our Reports"
          value={stats.reportsSubmitted}
          icon={FileBarChart}
          description="Total reports submitted"
        />
      </div>

      {/* Module Navigation */}
      <Section title="Quick Access">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* My Tasks */}
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5 text-blue-500" />
                Task Management
              </CardTitle>
              <CardDescription>View and update your assigned tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/portal/tasks/management">
                <Button className="w-full">Open Tasks</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Action Tracker */}
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-green-500" />
                Dept. Action Tracker
              </CardTitle>
              <CardDescription>Track and update weekly departmental actions</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/portal/tasks/action-tracker">
                <Button className="w-full" variant="outline" disabled={!profile?.department}>
                  {profile?.department ? "View Actions" : "No Department Assigned"}
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Weekly Reports */}
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileBarChart className="h-5 w-5 text-purple-500" />
                Weekly Reports
              </CardTitle>
              <CardDescription>Browse submitted reports from all departments</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/portal/tasks/weekly-reports">
                <Button className="w-full">Browse Reports</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Lead Controls */}
      {isLeadOrAdmin && (
        <Section title="Department Lead Actions">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-primary flex items-center gap-2">
                <Plus className="h-5 w-5" />
                New Weekly Submission
              </CardTitle>
              <CardDescription>Submit your weekly departmental progress report</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Link href="/portal/tasks/weekly-reports/new" className="flex-1">
                <Button className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  Create New Report
                </Button>
              </Link>
            </CardContent>
          </Card>
        </Section>
      )}
    </PageWrapper>
  )
}
