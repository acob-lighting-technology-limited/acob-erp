"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, FileText, Download } from "lucide-react"
import Link from "next/link"

interface AttendanceReport {
  user_id: string
  user_name: string
  department: string
  total_days: number
  present_days: number
  late_days: number
  absent_days: number
  total_hours: number
}

export default function AttendanceReportsPage() {
  const [loading, setLoading] = useState(false)
  const [reports, setReports] = useState<AttendanceReport[]>([])
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [filters, setFilters] = useState({
    department_id: "",
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    end_date: new Date().toISOString().split("T")[0],
  })

  useEffect(() => {
    fetchDepartments()
  }, [])

  async function fetchDepartments() {
    const supabase = createClient()
    const { data } = await supabase.from("departments").select("id, name").order("name")
    if (data) setDepartments(data)
  }

  async function generateReport() {
    setLoading(true)
    try {
      const supabase = createClient()

      let query = supabase
        .from("attendance_records")
        .select(
          `
                    *,
                    user:profiles!attendance_records_user_id_fkey (
                        id,
                        first_name,
                        last_name,
                        department_id,
                        department:departments (name)
                    )
                `
        )
        .gte("date", filters.start_date)
        .lte("date", filters.end_date)

      const { data } = await query

      if (data) {
        // Group by user
        const userMap = new Map<string, AttendanceReport>()

        data.forEach((record: any) => {
          const userId = record.user?.id
          if (!userId) return

          // Filter by department if selected
          if (filters.department_id && record.user.department_id !== filters.department_id) return

          if (!userMap.has(userId)) {
            userMap.set(userId, {
              user_id: userId,
              user_name: `${record.user.first_name} ${record.user.last_name}`,
              department: record.user.department?.name || "N/A",
              total_days: 0,
              present_days: 0,
              late_days: 0,
              absent_days: 0,
              total_hours: 0,
            })
          }

          const user = userMap.get(userId)!
          user.total_days++
          user.total_hours += record.total_hours || 0

          if (record.status === "present") user.present_days++
          else if (record.status === "late") user.late_days++
          else if (record.status === "absent") user.absent_days++
        })

        setReports(Array.from(userMap.values()))
      }
    } catch (error) {
      console.error("Error generating report:", error)
    } finally {
      setLoading(false)
    }
  }

  function exportCSV() {
    const headers = ["Name", "Department", "Total Days", "Present", "Late", "Absent", "Total Hours"]
    const rows = reports.map((r) => [
      r.user_name,
      r.department,
      r.total_days,
      r.present_days,
      r.late_days,
      r.absent_days,
      r.total_hours.toFixed(1),
    ])

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `attendance_report_${filters.start_date}_${filters.end_date}.csv`
    a.click()
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Link href="/admin/hr" className="text-muted-foreground hover:text-foreground flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Attendance
        </Link>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Attendance Reports</h1>
          <p className="text-muted-foreground">Generate and export attendance reports</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={filters.department_id}
                onValueChange={(value) => setFilters({ ...filters, department_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={generateReport} disabled={loading} className="w-full">
                <FileText className="mr-2 h-4 w-4" />
                Generate Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Results */}
      {reports.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Report Results</CardTitle>
              <Button variant="outline" onClick={exportCSV}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
            <CardDescription>{reports.length} employees</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-2 py-3 text-left">Name</th>
                    <th className="px-2 py-3 text-left">Department</th>
                    <th className="px-2 py-3 text-center">Total Days</th>
                    <th className="px-2 py-3 text-center">Present</th>
                    <th className="px-2 py-3 text-center">Late</th>
                    <th className="px-2 py-3 text-center">Absent</th>
                    <th className="px-2 py-3 text-center">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.user_id} className="border-b last:border-0">
                      <td className="px-2 py-3 font-medium">{report.user_name}</td>
                      <td className="px-2 py-3">{report.department}</td>
                      <td className="px-2 py-3 text-center">{report.total_days}</td>
                      <td className="px-2 py-3 text-center text-green-600">{report.present_days}</td>
                      <td className="px-2 py-3 text-center text-yellow-600">{report.late_days}</td>
                      <td className="px-2 py-3 text-center text-red-600">{report.absent_days}</td>
                      <td className="px-2 py-3 text-center">{report.total_hours.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
