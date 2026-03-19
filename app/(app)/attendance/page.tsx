import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AttendanceContent } from "./attendance-content"

export interface AttendanceRecord {
  id: string
  date: string
  clock_in: string
  clock_out: string | null
  total_hours: number | null
  status: string
}

async function getAttendanceData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  const today = new Date().toISOString().split("T")[0]

  // Fetch today's record
  const { data: todayData } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", today)
    .single()

  // Fetch recent records
  const { data: recentData } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(7)

  return {
    todayRecord: todayData as AttendanceRecord | null,
    recentRecords: (recentData || []) as AttendanceRecord[],
  }
}

export default async function AttendancePage() {
  const data = await getAttendanceData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const attendanceData = data as {
    todayRecord: AttendanceRecord | null
    recentRecords: AttendanceRecord[]
  }

  return (
    <AttendanceContent
      initialTodayRecord={attendanceData.todayRecord}
      initialRecentRecords={attendanceData.recentRecords}
    />
  )
}
