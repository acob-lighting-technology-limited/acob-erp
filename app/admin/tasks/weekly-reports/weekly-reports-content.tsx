"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  FileBarChart,
  Presentation,
  Search,
  User,
  Building,
  CalendarDays,
  CheckCircle2,
  Target,
  AlertTriangle,
  Edit2,
  Trash2,
  MoreVertical,
} from "lucide-react"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Link from "next/link"
// import pptxgen from "pptxgenjs"

interface WeeklyReport {
  id: string
  department: string
  week_number: number
  year: number
  work_done: string
  tasks_new_week: string
  challenges: string
  status: string
  created_at: string
  profiles: {
    first_name: string
    last_name: string
  }
}

interface WeeklyReportsContentProps {
  initialDepartments: string[]
}

export function WeeklyReportsContent({ initialDepartments }: WeeklyReportsContentProps) {
  const [reports, setReports] = useState<WeeklyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [weekFilter, setWeekFilter] = useState(new Date().getMonth() * 4 + Math.ceil(new Date().getDate() / 7))
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear())
  const [deptFilter, setDeptFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  const supabase = createClient()

  const loadReports = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from("weekly_reports")
        .select("*, profiles(first_name, last_name)")
        .eq("status", "submitted")
        .eq("week_number", weekFilter)
        .eq("year", yearFilter)
        .order("department", { ascending: true })

      if (deptFilter !== "all") {
        query = query.eq("department", deptFilter)
      }

      const { data, error } = await query
      if (error) throw error
      setReports(data || [])
    } catch (error) {
      console.error("Error loading reports:", error)
      toast.error("Failed to load reports")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [weekFilter, yearFilter, deptFilter])

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? Admin delete is permanent.")) return
    try {
      const { error } = await supabase.from("weekly_reports").delete().eq("id", id)
      if (error) throw error
      toast.success("Report deleted")
      loadReports()
    } catch (error) {
      toast.error("Delete failed")
    }
  }

  /*
  const exportToPPT = async (report: WeeklyReport) => {
    try {
      const pptxgen = (await import("pptxgenjs")).default
      const pres = new pptxgen()
      pres.layout = "LAYOUT_WIDE"

      // Slide 1: Title
      const slide1 = pres.addSlide()
      slide1.background = { color: "#F8FAFC" }
      slide1.addText(`Weekly Departmental Report`, {
        x: 0,
        y: 1.5,
        w: "100%",
        h: 0.5,
        align: "center",
        fontSize: 36,
        color: "#1E293B",
        bold: true,
      })
      slide1.addText(`${report.department} | Week ${report.week_number}, ${report.year}`, {
        x: 0,
        y: 2.2,
        w: "100%",
        h: 0.4,
        align: "center",
        fontSize: 24,
        color: "#64748B",
      })

      // Slide 2: Work Done
      const slide2 = pres.addSlide()
      slide2.addText("Work Done", { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 24, bold: true, color: "#2563EB" })
      slide2.addText(report.work_done || "No data provided", {
        x: 0.5,
        y: 1.2,
        w: 9,
        h: 4,
        fontSize: 16,
        color: "#334155",
        valign: "top",
      })

      // Slide 3: Tasks for New Week
      const slide3 = pres.addSlide()
      slide3.addText("Tasks for New Week", { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 24, bold: true, color: "#10B981" })
      slide3.addText(report.tasks_new_week || "No data provided", {
        x: 0.5,
        y: 1.2,
        w: 9,
        h: 4,
        fontSize: 16,
        color: "#334155",
        valign: "top",
      })

      // Slide 4: Challenges
      const slide4 = pres.addSlide()
      slide4.addText("Challenges", { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 24, bold: true, color: "#EF4444" })
      slide4.addText(report.challenges || "No data provided", {
        x: 0.5,
        y: 1.2,
        w: 9,
        h: 4,
        fontSize: 16,
        color: "#334155",
        valign: "top",
      })

      pres.writeFile({ fileName: `${report.department}_W${report.week_number}_Report.pptx` })
      toast.success("PowerPoint generated successfully")
    } catch (error) {
      console.error("PPT Error:", error)
      toast.error("Failed to generate PowerPoint")
    }
  }
  */

  const filteredReports = reports.filter(
    (r) =>
      r.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.work_done.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <AdminTablePage
      title="Weekly Reports"
      description="Review and export departmental reports"
      icon={FileBarChart}
      filters={
        <div className="mb-6 flex flex-col gap-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <div className="w-24">
              <Input
                type="number"
                value={weekFilter}
                onChange={(e) => setWeekFilter(parseInt(e.target.value))}
                title="Week Number"
              />
            </div>
            <div className="w-28">
              <Input
                type="number"
                value={yearFilter}
                onChange={(e) => setYearFilter(parseInt(e.target.value))}
                title="Year"
              />
            </div>
            <div className="w-48">
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {initialDepartments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      }
    >
      <div className="grid gap-6">
        {loading ? (
          <div className="text-muted-foreground py-20 text-center">Loading reports...</div>
        ) : filteredReports.length === 0 ? (
          <div className="text-muted-foreground py-20 text-center">No reports found for this week.</div>
        ) : (
          filteredReports.map((report) => (
            <Card key={report.id} className="overflow-hidden border-2 shadow-sm">
              <CardHeader className="bg-muted/30 border-b p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 rounded-lg p-2">
                      <Building className="text-primary h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{report.department}</CardTitle>
                      <CardDescription className="mt-1 flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {report.profiles?.first_name} {report.profiles?.last_name}
                        </span>
                        <span className="text-primary flex items-center gap-1 font-medium">
                          <CalendarDays className="h-3 w-3" />
                          Week {report.week_number}, {report.year}
                        </span>
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {/* <Button variant="outline" size="sm" onClick={() => exportToPPT(report)} className="gap-2 bg-white">
                      <Presentation className="h-4 w-4 text-orange-600" />
                      Export to PPTX
                    </Button> */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <Link
                          href={`/portal/tasks/weekly-reports/new?week=${report.week_number}&year=${report.year}&dept=${report.department}`}
                        >
                          <DropdownMenuItem className="cursor-pointer gap-2">
                            <Edit2 className="h-4 w-4" /> Edit Override
                          </DropdownMenuItem>
                        </Link>
                        <DropdownMenuItem
                          className="text-destructive cursor-pointer gap-2"
                          onClick={() => handleDelete(report.id)}
                        >
                          <Trash2 className="h-4 w-4" /> Delete Permanently
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-6 pt-6 md:grid-cols-3">
                <div>
                  <h4 className="mb-2 flex items-center gap-2 text-xs font-bold text-blue-600 uppercase">
                    <CheckCircle2 className="h-4 w-4" />
                    Work Done
                  </h4>
                  <div className="text-foreground min-h-[100px] rounded-xl border border-blue-100 bg-blue-50/20 p-4 text-sm whitespace-pre-wrap">
                    {report.work_done}
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 flex items-center gap-2 text-xs font-bold text-green-600 uppercase">
                    <Target className="h-4 w-4" />
                    Tasks New Week
                  </h4>
                  <div className="text-foreground min-h-[100px] rounded-xl border border-green-100 bg-green-50/20 p-4 text-sm whitespace-pre-wrap">
                    {report.tasks_new_week}
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 flex items-center gap-2 text-xs font-bold text-red-600 uppercase">
                    <AlertTriangle className="h-4 w-4" />
                    Challenges
                  </h4>
                  <div className="text-foreground min-h-[100px] rounded-xl border border-red-100 bg-red-50/20 p-4 text-sm whitespace-pre-wrap">
                    {report.challenges}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AdminTablePage>
  )
}
