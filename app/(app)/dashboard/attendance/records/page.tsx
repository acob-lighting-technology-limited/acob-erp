"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, Calendar } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState } from "@/components/ui/patterns"

interface AttendanceRecord {
  id: string
  date: string
  clock_in: string
  clock_out: string | null
  total_hours: number | null
  status: string
}

export default function AttendanceRecordsPage() {
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<AttendanceRecord[]>([])

  useEffect(() => {
    fetchRecords()
  }, [])

  async function fetchRecords() {
    try {
      // Get last 30 days
      const endDate = new Date().toISOString().split("T")[0]
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

      const response = await fetch(`/api/hr/attendance/records?start_date=${startDate}&end_date=${endDate}`)
      const data = await response.json()
      if (data.records) {
        setRecords(data.records)
      }
    } catch (error) {
      console.error("Error fetching records:", error)
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  }

  function formatTime(timeString: string | null) {
    if (!timeString) return "-"
    return timeString.substring(0, 5)
  }

  function getStatusBadge(status: string) {
    const colors: { [key: string]: string } = {
      present: "bg-green-100 text-green-800",
      late: "bg-yellow-100 text-yellow-800",
      absent: "bg-red-100 text-red-800",
      half_day: "bg-orange-100 text-orange-800",
    }
    return colors[status] || "bg-gray-100 text-gray-800"
  }

  const totalHours = records.reduce((sum, r) => sum + (r.total_hours || 0), 0)
  const presentDays = records.filter((r) => r.status === "present").length

  return (
    <div className="container mx-auto p-6">
      <PageHeader
        title="My Attendance Records"
        description="Last 30 days of attendance history"
        backLink={{ href: "/dashboard/attendance", label: "Back to Attendance" }}
        className="mb-6"
      />

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 md:gap-4">
        <StatCard title="Total Days" value={records.length} description="Days recorded" icon={Calendar} />
        <StatCard title="Present Days" value={presentDays} description="Full attendance" icon={Calendar} />
        <StatCard title="Total Hours" value={totalHours.toFixed(1)} description="Hours worked" icon={Clock} />
      </div>

      {/* Records List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Attendance History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center">Loading...</div>
          ) : records.length === 0 ? (
            <EmptyState
              title="No attendance records found"
              description="Attendance entries for the selected period will appear here."
              icon={Calendar}
              className="border-0"
            />
          ) : (
            <div className="space-y-2">
              <div className="bg-muted grid grid-cols-5 gap-4 rounded-lg px-4 py-2 text-sm font-medium">
                <div>Date</div>
                <div>Clock In</div>
                <div>Clock Out</div>
                <div>Hours</div>
                <div>Status</div>
              </div>
              {records.map((record) => (
                <div key={record.id} className="grid grid-cols-5 gap-4 border-b px-4 py-3 last:border-0">
                  <div className="font-medium">{formatDate(record.date)}</div>
                  <div className="flex items-center gap-1">
                    <Clock className="text-muted-foreground h-3 w-3" />
                    {formatTime(record.clock_in)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="text-muted-foreground h-3 w-3" />
                    {formatTime(record.clock_out)}
                  </div>
                  <div>{record.total_hours?.toFixed(1) || "-"}</div>
                  <div>
                    <Badge className={getStatusBadge(record.status)}>{record.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
