"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, Loader2, MessageSquare, Search } from "lucide-react"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/ui/stat-card"
import { exportPmsRowsToExcel } from "@/lib/pms/export"

type Profile = {
  id: string
  first_name: string | null
  last_name: string | null
  department: string | null
}

type PeerFeedbackRow = {
  id: string
  subject_user_id: string
  reviewer_user_id: string
  review_cycle_id: string
  score: number
  collaboration: number | null
  communication: number | null
  teamwork: number | null
  professionalism: number | null
  comments: string | null
  status: string
  created_at: string
  subject?: Profile | null
  reviewer?: Profile | null
}

type Cycle = {
  id: string
  name: string
}

function formatName(profile: Profile | null | undefined) {
  if (!profile) return "Unknown"
  return `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Unknown"
}

function formatMetric(value: number | null | undefined) {
  return typeof value === "number" ? `${value}%` : "-"
}

export default function AdminPeerFeedbackPage() {
  const [feedback, setFeedback] = useState<PeerFeedbackRow[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [cycleFilter, setCycleFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [feedbackRes, cyclesRes] = await Promise.all([
        fetch("/api/hr/performance/peer-feedback?subject_user_id=all_admin"),
        fetch("/api/hr/performance/cycles"),
      ])
      const [feedbackData, cyclesData] = await Promise.all([
        feedbackRes.json().catch(() => ({})),
        cyclesRes.json().catch(() => ({})),
      ])
      if (!feedbackRes.ok) throw new Error(feedbackData?.error || "Failed to load feedback")
      setFeedback((feedbackData?.data || []) as PeerFeedbackRow[])
      setCycles((cyclesData?.data || []) as Cycle[])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const departments = useMemo(
    () => Array.from(new Set(feedback.map((f) => f.subject?.department).filter(Boolean) as string[])).sort(),
    [feedback]
  )

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return feedback.filter((f) => {
      const subjectName = formatName(f.subject).toLowerCase()
      const dept = String(f.subject?.department || "").toLowerCase()
      const cycleMatch = cycleFilter === "all" || f.review_cycle_id === cycleFilter
      const deptMatch = departmentFilter === "all" || f.subject?.department === departmentFilter
      const searchMatch = !q || subjectName.includes(q) || dept.includes(q)
      return cycleMatch && deptMatch && searchMatch
    })
  }, [feedback, searchQuery, cycleFilter, departmentFilter])

  const avgScore =
    filtered.length > 0
      ? Math.round((filtered.reduce((sum, f) => sum + f.score, 0) / filtered.length) * 100) / 100
      : null

  const exportRows = filtered.map((f, index) => ({
    "S/N": index + 1,
    Subject: formatName(f.subject),
    Department: f.subject?.department || "-",
    Score: f.score,
    Collaboration: f.collaboration ?? "-",
    Communication: f.communication ?? "-",
    Teamwork: f.teamwork ?? "-",
    Professionalism: f.professionalism ?? "-",
    Comments: f.comments || "",
    Status: f.status,
    Date: new Date(f.created_at).toLocaleDateString(),
  }))

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Peer Feedback"
        description="View peer feedback submissions across all employees and cycles."
        icon={MessageSquare}
        backLink={{ href: "/admin/hr/pms", label: "Back to PMS" }}
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={filtered.length === 0}
            onClick={() =>
              void exportPmsRowsToExcel(exportRows, `peer-feedback-${new Date().toISOString().slice(0, 10)}`)
            }
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          title="Total Submissions"
          value={filtered.length}
          icon={MessageSquare}
          description="Peer feedback rows"
        />
        <StatCard
          title="Unique Subjects"
          value={new Set(filtered.map((f) => f.subject_user_id)).size}
          icon={MessageSquare}
          description="Employees reviewed"
        />
        <StatCard
          title="Avg Score"
          value={avgScore !== null ? `${avgScore}%` : "-"}
          icon={MessageSquare}
          description="Overall average"
        />
        <StatCard
          title="Submitted"
          value={filtered.filter((f) => f.status === "submitted").length}
          icon={MessageSquare}
          description="Completed submissions"
        />
      </div>

      <Card className="mb-4">
        <CardContent className="p-3 sm:p-6">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search employee or department…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={cycleFilter} onValueChange={setCycleFilter}>
              <SelectTrigger className="w-full md:w-56">
                <SelectValue placeholder="Cycle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cycles</SelectItem>
                {cycles.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Peer Feedback Submissions</CardTitle>
          <CardDescription>
            Each row is one peer feedback entry. Subject names are shown; reviewer names are not disclosed to employees.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-10">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : error ? (
            <div className="space-y-2 py-4">
              <p className="text-sm text-red-500">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void loadData()}>
                Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No peer feedback found. Employees submit feedback via the PMS → Peer Feedback page.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader className="bg-emerald-50 dark:bg-emerald-950/30">
                  <TableRow>
                    <TableHead className="w-12">S/N</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Collab</TableHead>
                    <TableHead>Comms</TableHead>
                    <TableHead>Teamwork</TableHead>
                    <TableHead>Professionalism</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((f, index) => (
                    <TableRow key={f.id}>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-medium">{formatName(f.subject)}</TableCell>
                      <TableCell>{f.subject?.department || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={f.score >= 70 ? "default" : "secondary"}>{f.score}%</Badge>
                      </TableCell>
                      <TableCell>{formatMetric(f.collaboration)}</TableCell>
                      <TableCell>{formatMetric(f.communication)}</TableCell>
                      <TableCell>{formatMetric(f.teamwork)}</TableCell>
                      <TableCell>{formatMetric(f.professionalism)}</TableCell>
                      <TableCell>
                        <Badge variant={f.status === "submitted" ? "default" : "secondary"}>{f.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(f.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </PageWrapper>
  )
}
