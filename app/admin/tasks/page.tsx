"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { getCurrentISOWeek } from "@/lib/utils"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ClipboardList,
  LayoutDashboard,
  FileSpreadsheet,
  FileBarChart,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react"
import Link from "next/link"
import { PageWrapper, PageHeader, Section } from "@/components/layout"
import { StatCard } from "@/components/ui/stat-card"

interface TaskStats {
  totalTasks: number
  pendingActions: number
  submittedReports: number
  completedThisWeek: number
}

export default function AdminTasksDashboard() {
  const [stats, setStats] = useState<TaskStats>({
    totalTasks: 0,
    pendingActions: 0,
    submittedReports: 0,
    completedThisWeek: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    try {
      const supabase = createClient()

      const currentWeek = getCurrentISOWeek()
      const currentYear = new Date().getFullYear()

      // Total general tasks
      const { count: taskCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("category", "general")

      // Pending weekly actions
      const { count: pendingCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("category", "weekly_action")
        .neq("status", "completed")

      // Submitted weekly reports for current week
      const { data: reports } = await supabase
        .from("weekly_reports")
        .select("id")
        .eq("status", "submitted")
        .eq("week_number", currentWeek)
        .eq("year", currentYear)

      // Completed actions this week
      const { count: completedCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("category", "weekly_action")
        .eq("status", "completed")
        .eq("week_number", currentWeek)
        .eq("year", currentYear)

      setStats({
        totalTasks: taskCount || 0,
        pendingActions: pendingCount || 0,
        submittedReports: reports?.length || 0,
        completedThisWeek: completedCount || 0,
      })
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Tasks & Reporting"
        description="Manage general tasks, departmental actions, and weekly reporting"
        icon={ClipboardList}
        backLink={{ href: "/admin", label: "Back to Admin" }}
      />

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="General Tasks"
          value={stats.totalTasks}
          icon={LayoutDashboard}
          description="Active standalone tasks"
        />
        <StatCard
          title="Pending Actions"
          value={stats.pendingActions}
          icon={Clock}
          description="Weekly actions in progress"
        />
        <StatCard
          title="Reports Submitted"
          value={stats.submittedReports}
          icon={FileBarChart}
          description="Departmental reports received"
        />
        <StatCard
          title="Completed Actions"
          value={stats.completedThisWeek}
          icon={CheckCircle2}
          description="Successfully closed this week"
        />
      </div>

      {/* Admin Actions */}
      <Section title="Management Modules">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* General Task Management */}
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5 text-blue-500" />
                Task Management
              </CardTitle>
              <CardDescription>Create and assign general standalone tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/tasks/management">
                <Button className="w-full">Open Management</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Action Tracker */}
          <Card className="border-primary/20 bg-primary/5 transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-green-500" />
                Action Tracker
              </CardTitle>
              <CardDescription>Bulk import weekly actions from Excel sheets</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/tasks/action-tracker">
                <Button className="w-full" variant="default">
                  Manage Actions
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
              <CardDescription>Review and export departmental weekly reports</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/tasks/weekly-reports">
                <Button className="w-full" variant="outline">
                  Review Reports
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Status Overview */}
      <Section title="Current Status">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {stats.pendingActions > 0 && (
                <div className="flex items-center gap-4">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  <div className="flex-1">
                    <p className="font-medium">{stats.pendingActions} actions pending across departments</p>
                    <p className="text-muted-foreground text-sm">Requires follow-up with leads</p>
                  </div>
                  <Link href="/admin/tasks/action-tracker">
                    <Button size="sm">Follow up</Button>
                  </Link>
                </div>
              )}

              <div className="flex items-center gap-4">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div className="flex-1">
                  <p className="font-medium">{stats.completedThisWeek} actions completed</p>
                  <p className="text-muted-foreground text-sm">Productivity this week</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Section>
    </PageWrapper>
  )
}
