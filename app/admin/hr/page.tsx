"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, TrendingUp, Users, CheckCircle, AlertCircle, FileText, ArrowLeft } from "lucide-react"
import Link from "next/link"

interface DashboardStats {
  pendingLeaveRequests: number
  todayAttendance: number
  upcomingReviews: number
  totalStaff: number
}

export default function HRAdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    pendingLeaveRequests: 0,
    todayAttendance: 0,
    upcomingReviews: 0,
    totalStaff: 0,
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

      // Fetch total staff
      const { count: staffCount } = await supabase.from("profiles").select("*", { count: "exact", head: true })

      setStats({
        pendingLeaveRequests: leaveRequests?.length || 0,
        todayAttendance: attendance?.length || 0,
        upcomingReviews: reviews?.length || 0,
        totalStaff: staffCount || 0,
      })
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link href="/admin" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-bold">HR Administration</h1>
          </div>
          <p className="text-muted-foreground">Manage leave approvals, attendance reports, and performance reviews</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Leave</CardTitle>
            <Calendar className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingLeaveRequests}</div>
            <p className="text-muted-foreground text-xs">Requests awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Attendance</CardTitle>
            <Clock className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayAttendance}</div>
            <p className="text-muted-foreground text-xs">Staff clocked in today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
            <FileText className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingReviews}</div>
            <p className="text-muted-foreground text-xs">Reviews to complete</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
            <Users className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalStaff}</div>
            <p className="text-muted-foreground text-xs">Registered employees</p>
          </CardContent>
        </Card>
      </div>

      {/* Admin Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
            <CardDescription>Create and manage staff reviews</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/hr/performance/create">
              <Button className="w-full">Create Review</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Actions</CardTitle>
          <CardDescription>Items requiring your attention</CardDescription>
        </CardHeader>
        <CardContent>
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
                  <p className="font-medium">{stats.todayAttendance} staff clocked in</p>
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
    </div>
  )
}
