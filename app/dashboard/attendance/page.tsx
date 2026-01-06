"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, LogIn, LogOut } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface AttendanceRecord {
  id: string
  date: string
  clock_in: string
  clock_out: string | null
  total_hours: number | null
  status: string
}

export default function AttendancePage() {
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null)
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchAttendanceData()
  }, [])

  async function fetchAttendanceData() {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const today = new Date().toISOString().split("T")[0]

      // Fetch today's record
      const { data: todayData } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .single()

      setTodayRecord(todayData)

      // Fetch recent records
      const { data: recentData } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(7)

      setRecentRecords(recentData || [])
    } catch (error) {
      console.error("Error fetching attendance:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleClockIn() {
    setActionLoading(true)
    try {
      const response = await fetch("/api/hr/attendance/clock-in", {
        method: "POST",
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: "Clocked in successfully",
        })
        fetchAttendanceData()
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to clock in",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  async function handleClockOut() {
    setActionLoading(true)
    try {
      const response = await fetch("/api/hr/attendance/clock-out", {
        method: "POST",
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: "Clocked out successfully",
        })
        fetchAttendanceData()
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to clock out",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Attendance</h1>
        <p className="text-muted-foreground">Track your work hours</p>
      </div>

      {/* Clock In/Out Card */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Attendance</CardTitle>
          <CardDescription>
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center">Loading...</p>
          ) : (
            <div className="space-y-4">
              {todayRecord ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                    <div className="flex items-center gap-4">
                      <LogIn className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="font-medium">Clock In</p>
                        <p className="text-2xl font-bold">{todayRecord.clock_in}</p>
                      </div>
                    </div>
                    {todayRecord.clock_out && (
                      <div className="flex items-center gap-4">
                        <LogOut className="h-5 w-5 text-red-500" />
                        <div>
                          <p className="font-medium">Clock Out</p>
                          <p className="text-2xl font-bold">{todayRecord.clock_out}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {todayRecord.total_hours && (
                    <div className="rounded-lg bg-blue-50 p-4 text-center">
                      <p className="text-muted-foreground text-sm">Total Work Hours</p>
                      <p className="text-3xl font-bold text-blue-600">{todayRecord.total_hours.toFixed(2)} hrs</p>
                    </div>
                  )}

                  {!todayRecord.clock_out && (
                    <Button onClick={handleClockOut} disabled={actionLoading} className="w-full" variant="destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      Clock Out
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4 text-center">
                  <Clock className="text-muted-foreground mx-auto h-16 w-16" />
                  <p className="text-muted-foreground">You haven't clocked in today</p>
                  <Button onClick={handleClockIn} disabled={actionLoading} className="w-full">
                    <LogIn className="mr-2 h-4 w-4" />
                    Clock In
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Attendance */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Attendance</CardTitle>
          <CardDescription>Your attendance history for the past week</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentRecords.map((record) => (
              <div key={record.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">{new Date(record.date).toLocaleDateString()}</p>
                  <p className="text-muted-foreground text-sm">
                    {record.clock_in} - {record.clock_out || "In Progress"}
                  </p>
                </div>
                <div className="text-right">
                  {record.total_hours ? (
                    <>
                      <p className="font-bold">{record.total_hours.toFixed(2)} hrs</p>
                      <Badge variant="outline" className="mt-1">
                        {record.status}
                      </Badge>
                    </>
                  ) : (
                    <Badge variant="outline">In Progress</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
