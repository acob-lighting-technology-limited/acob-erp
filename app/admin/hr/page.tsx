"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, TrendingUp, Users, CheckCircle, AlertCircle, FileText, Building } from "lucide-react"
import Link from "next/link"
import { PageWrapper, PageHeader, Section } from "@/components/layout"
import { StatCard } from "@/components/ui/stat-card"

interface DashboardStats {
  pendingLeaveRequests: number
  todayAttendance: number
  upcomingReviews: number
  totalEmployees: number
  totalDepartments: number
}

export default function HRAdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    pendingLeaveRequests: 0,
    todayAttendance: 0,
    upcomingReviews: 0,
    totalEmployees: 0,
    totalDepartments: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    try {
      const supabase = createClient()

      // Fetch pending leave requests
      const { data: leaveRequests } = await supabase.from("leave_requests").select("id").eq("status", "pending")

      // Fetch today's attendance
      const today = new Date().toISOString().split("T")[0]
      const { data: attendance } = await supabase.from("attendance_records").select("id").eq("date", today)

      // Fetch upcoming reviews
      const { data: reviews } = await supabase.from("performance_reviews").select("id").eq("status", "draft")

      // Fetch total employees
      const { count: employeeCount } = await supabase.from("profiles").select("*", { count: "exact", head: true })
      const { count: departmentCount } = await supabase.from("departments").select("*", { count: "exact", head: true })

      setStats({
        pendingLeaveRequests: leaveRequests?.length || 0,
        todayAttendance: attendance?.length || 0,
        upcomingReviews: reviews?.length || 0,
        totalEmployees: employeeCount || 0,
        totalDepartments: departmentCount || 0,
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
        title="HR Administration"
        description="Manage leave approvals, attendance reports, and performance reviews"
        icon={Users}
        backLink={{ href: "/admin", label: "Back to Admin" }}
      />

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Pending Leave"
          value={stats.pendingLeaveRequests}
          icon={Calendar}
          description="Requests awaiting approval"
        />
        <StatCard
          title="Today's Attendance"
          value={stats.todayAttendance}
          icon={Clock}
          description="Employees clocked in today"
        />
        <StatCard
          title="Pending Reviews"
          value={stats.upcomingReviews}
          icon={FileText}
          description="Reviews to complete"
        />
        <StatCard
          title="Total Employees"
          value={stats.totalEmployees}
          icon={Users}
          description="Registered employees"
        />
        <StatCard
          title="Total Departments"
          value={stats.totalDepartments}
          icon={Building}
          description="Configured departments"
        />
      </div>

      {/* Admin Actions */}
      <Section title="HR Management">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Employees Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Employees
              </CardTitle>
              <CardDescription>Manage employee profiles and information</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/hr/employees">
                <Button className="w-full">Manage Employees ({stats.totalEmployees})</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Departments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Departments
              </CardTitle>
              <CardDescription>Manage company departments</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/hr/departments">
                <Button className="w-full">Manage Departments ({stats.totalDepartments})</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Leave Approvals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Leave Approvals
              </CardTitle>
              <CardDescription>Review and approve leave requests</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/hr/leave/approve">
                <Button className="w-full">Approve Requests ({stats.pendingLeaveRequests})</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Attendance Reports */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Attendance Reports
              </CardTitle>
              <CardDescription>View and export attendance data</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/hr/attendance/reports">
                <Button className="w-full">View Reports</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Performance Reviews */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Performance Reviews
              </CardTitle>
              <CardDescription>Create and manage employee reviews</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/hr/performance/create">
                <Button className="w-full">Create Review</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Pending Actions */}
      <Section title="Pending Actions">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {stats.pendingLeaveRequests > 0 && (
                <div className="flex items-center gap-4">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  <div className="flex-1">
                    <p className="font-medium">{stats.pendingLeaveRequests} pending leave requests</p>
                    <p className="text-muted-foreground text-sm">Require your approval</p>
                  </div>
                  <Link href="/admin/hr/leave/approve">
                    <Button size="sm">Review</Button>
                  </Link>
                </div>
              )}

              {stats.todayAttendance > 0 && (
                <div className="flex items-center gap-4">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div className="flex-1">
                    <p className="font-medium">{stats.todayAttendance} employees clocked in</p>
                    <p className="text-muted-foreground text-sm">Today's attendance</p>
                  </div>
                </div>
              )}

              {stats.upcomingReviews > 0 && (
                <div className="flex items-center gap-4">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <div className="flex-1">
                    <p className="font-medium">{stats.upcomingReviews} reviews pending</p>
                    <p className="text-muted-foreground text-sm">Performance reviews to complete</p>
                  </div>
                  <Link href="/admin/hr/performance/create">
                    <Button size="sm">Create</Button>
                  </Link>
                </div>
              )}

              {stats.pendingLeaveRequests === 0 && stats.upcomingReviews === 0 && (
                <div className="text-muted-foreground flex items-center gap-4">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <p>All caught up! No pending actions.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </Section>
    </PageWrapper>
  )
}
