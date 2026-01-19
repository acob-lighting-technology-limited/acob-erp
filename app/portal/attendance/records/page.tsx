"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Clock, Calendar } from "lucide-react"
import Link from "next/link"

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
      <div className="mb-6">
        <Link
          href="/dashboard/attendance"
          className="text-muted-foreground hover:text-foreground flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Attendance
        </Link>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Attendance Records</h1>
          <p className="text-muted-foreground">Last 30 days of attendance history</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{records.length}</div>
            <p className="text-muted-foreground text-xs">Days recorded</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Present Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{presentDays}</div>
            <p className="text-muted-foreground text-xs">Full attendance</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHours.toFixed(1)}</div>
            <p className="text-muted-foreground text-xs">Hours worked</p>
          </CardContent>
        </Card>
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
            <div className="text-muted-foreground py-8 text-center">No attendance records found</div>
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
