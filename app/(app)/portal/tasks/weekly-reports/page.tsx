"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  FileSearch,
  Calendar,
  Building2,
  ExternalLink,
  Plus,
  FileBarChart,
  Search,
  Filter,
  Edit2,
  Trash2,
  MoreVertical,
  Loader2,
  CheckCircle2,
  Target,
  AlertTriangle,
  Building,
} from "lucide-react"
import Link from "next/link"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { PageWrapper, PageHeader } from "@/components/layout"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

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
  user_id: string
  profiles: {
    full_name: string
  }
}

export default function WeeklyReportsPortal() {
  const [reports, setReports] = useState<WeeklyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [deptFilter, setDeptFilter] = useState("all")
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear())
  const [weekFilter, setWeekFilter] = useState(new Date().getMonth() * 4 + Math.ceil(new Date().getDate() / 7))
  const [allDepartments, setAllDepartments] = useState<string[]>([])

  const supabase = createClient()

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (profile) {
      loadReports()
    }
  }, [profile, weekFilter, yearFilter, deptFilter])

  async function fetchInitialData() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data: p } = await supabase.from("profiles").select("id, department, role").eq("id", user.id).single()
        setProfile(p)

        // Fetch all departments for filtering
        const { data: depts } = await supabase.from("profiles").select("department").not("department", "is", null)
        const uniqueDepts = Array.from(new Set(depts?.map((d) => d.department).filter(Boolean))) as string[]
        setAllDepartments(uniqueDepts.sort())

        if (p?.role === "lead") {
          setDeptFilter(p.department || "all")
        }
      }
    } catch (error) {
      console.error("Error fetching initial data:", error)
    }
  }

  async function loadReports() {
    setLoading(true)
    try {
      let query = supabase
        .from("weekly_reports")
        .select("*, profiles:user_id ( full_name )")
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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? Delete is permanent.")) return

    try {
      const { error } = await supabase.from("weekly_reports").delete().eq("id", id)
      if (error) throw error
      toast.success("Report deleted")
      loadReports()
    } catch (error) {
      toast.error("Failed to delete report")
    }
  }

  const filteredReports = reports.filter(
    (r) =>
      r.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.work_done?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <AdminTablePage
      title="Weekly Departmental Reports"
      description="Browse weekly updates and progress from all departments"
      icon={FileBarChart}
      backLinkHref="/dashboard"
      backLinkLabel="Back to Dashboard"
      actions={
        (profile?.role === "lead" || profile?.role === "admin" || profile?.role === "super_admin") && (
          <Link href="/portal/tasks/weekly-reports/new">
            <Button className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              Submit New Report
            </Button>
          </Link>
        )
      }
      filters={
        <div className="flex flex-col gap-4 md:flex-row">
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
            <Input
              type="number"
              className="w-24"
              value={weekFilter}
              onChange={(e) => setWeekFilter(parseInt(e.target.value))}
              placeholder="Week"
              title="Week Number"
            />
            <Input
              type="number"
              className="w-28"
              value={yearFilter}
              onChange={(e) => setYearFilter(parseInt(e.target.value))}
              placeholder="Year"
              title="Year"
            />
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Every Department</SelectItem>
                {allDepartments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      }
    >
      <div className="grid gap-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
          </div>
        ) : filteredReports.length === 0 ? (
          <Card className="border-2 border-dashed p-20 text-center">
            <FileSearch className="text-muted-foreground mx-auto mb-4 h-12 w-12 opacity-20" />
            <p className="text-muted-foreground">No reports found matching your filters.</p>
          </Card>
        ) : (
          filteredReports.map((report) => {
            const isOwner = profile?.department === report.department
            const isAdmin = ["admin", "super_admin"].includes(profile?.role)

            return (
              <Card key={report.id} className="overflow-hidden border-2 shadow-sm transition-shadow hover:shadow-lg">
                <CardHeader className="bg-muted/30 border-b p-4 px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 rounded-lg p-2">
                        <Building2 className="text-primary h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{report.department}</CardTitle>
                        <CardDescription className="mt-1 flex items-center gap-3 text-sm">
                          <span className="text-primary/80 flex items-center gap-1 font-medium">
                            Week {report.week_number}, {report.year}
                          </span>
                          <span className="text-muted-foreground/50">|</span>
                          <span className="flex items-center gap-1">By {report.profiles?.full_name}</span>
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(isOwner || isAdmin) && (
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
                                <Edit2 className="h-4 w-4" /> Edit Report
                              </DropdownMenuItem>
                            </Link>
                            <DropdownMenuItem
                              className="text-destructive cursor-pointer gap-2"
                              onClick={() => handleDelete(report.id)}
                            >
                              <Trash2 className="h-4 w-4" /> Delete Report
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-8 p-6 md:grid-cols-3">
                  <div className="space-y-3">
                    <h4 className="flex items-center gap-2 text-xs font-bold tracking-wider text-blue-600 uppercase">
                      <CheckCircle2 className="h-3 w-3" />
                      Work Done
                    </h4>
                    <div className="text-foreground/90 min-h-[100px] rounded-xl border border-blue-100 bg-blue-50/20 p-4 text-sm leading-relaxed whitespace-pre-wrap">
                      {report.work_done || "No summary provided."}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="flex items-center gap-2 text-xs font-bold tracking-wider text-green-600 uppercase">
                      <Target className="h-3 w-3" />
                      Next Week Goals
                    </h4>
                    <div className="text-foreground/90 min-h-[100px] rounded-xl border border-green-100 bg-green-50/20 p-4 text-sm leading-relaxed whitespace-pre-wrap">
                      {report.tasks_new_week || "No goals listed."}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="flex items-center gap-2 text-xs font-bold tracking-wider text-red-600 uppercase">
                      <AlertTriangle className="h-3 w-3" />
                      Challenges
                    </h4>
                    <div className="text-foreground/90 min-h-[100px] rounded-xl border border-red-100 bg-red-50/20 p-4 text-sm leading-relaxed whitespace-pre-wrap">
                      {report.challenges || "No challenges reported."}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </AdminTablePage>
  )
}
